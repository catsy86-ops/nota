// Pomiar wyszukiwania notatek na emulowanym telefonie (plan 3.2): Worker kontra główny wątek.
// Użycie: node scripts/measure-notatki.mjs [notatki=3000] [adres=http://127.0.0.1:4174] [powtórzenia=3] [dławienie=4]
// Wymaga zbudowanej aplikacji pod adresem (`npm run build && npx vite preview --port 4174`). Wynik: JSON na stdout.
// Ten sam build, dwa tryby: z Workerem i z usuniętym `window.Worker` (wtedy indeks liczy główny wątek).
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium, devices } from "@playwright/test";

const [countArg = "3000", base = "http://127.0.0.1:4174", runsArg = "3", throttleArg = "4"] = process.argv.slice(2);
const COUNT = Number(countArg), RUNS = Number(runsArg), THROTTLE = Number(throttleArg);

let seed = 20261112;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const WORDS = "rura zawór bateria kuchnia łazienka zlew pralka kocioł grzejnik montaż wymiana próba szczelności inwestor faktura termin materiał dostawa hurtownia podłączenie kanalizacja pion stelaż złączka kolano trójnik nypel uszczelka taśma pianka".split(" ");
const pick = (a) => a[Math.floor(rnd() * a.length)];
const now = Date.now();
const notes = Array.from({ length: COUNT }, (_, i) => ({
  id: `n${i}`, title: `${pick(WORDS)} ${pick(WORDS)} ${i}`,
  // Co setna notatka ma rzadkie słowo „zxqvbn”: zapytanie o nie trafia w ~1% notatek, więc mierzymy wyszukiwanie, a nie
  // rysowanie setek kart (słowa z listy pasują do prawie każdej notatki).
  content: Array.from({ length: 120 }, () => pick(WORDS)).join(" ") + (i % 100 === 0 ? " zxqvbn" : ""),
  color: "default", pinned: false, archived: false, trashed: false, trashedAt: null, labels: [pick(WORDS)], reminder: null,
  priority: "none", images: [], checklist: [], folderId: null, order: i, createdAt: now - i * 60_000, updatedAt: now - i * 60_000,
}));
const file = path.join(mkdtempSync(path.join(tmpdir(), "notki-")), "seed.json");
writeFileSync(file, JSON.stringify({ version: 3, exportedAt: now, notes, labels: [], folders: [] }));

const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const round = (n) => Math.round(n);
const browser = await chromium.launch();
const log = (m) => process.stderr.write(`[pomiar] ${m}\n`);

async function session(useWorker) {
  const context = await browser.newContext({ ...devices["Pixel 7"], serviceWorkers: "block" });
  const page = await context.newPage();
  await page.addInitScript((worker) => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    if (!worker) { try { delete window.Worker; } catch { window.Worker = undefined; } }
    window.__long = []; window.__events = [];
    try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push(e.duration))).observe({ type: "longtask", buffered: true }); } catch { /* brak */ }
    try { new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (e.interactionId) window.__events.push(e.duration); })).observe({ type: "event", durationThreshold: 16, buffered: true }); } catch { /* brak */ }
  }, useWorker);
  // Przywrócenie notatek z pliku (bez throttlingu: to tylko przygotowanie danych). `?settings=` otwiera Ustawienia od razu.
  await page.goto(base + "/?settings=kopia");
  await page.getByRole("button", { name: "Przywróć z pliku backupu" }).waitFor({ timeout: 30_000 });
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("button", { name: "Przywróć z pliku backupu" }).click()]);
  await chooser.setFiles(file);
  await page.getByRole("alertdialog").getByRole("button", { name: "Przywróć backup" }).click();
  await page.getByText(/Przywrócono kopię/).waitFor({ timeout: 120_000 });
  await page.waitForLoadState("load");
  await page.waitForTimeout(3000);
  await page.reload();
  await page.waitForSelector("[data-note-id]", { timeout: 60_000 });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: THROTTLE });
  await page.evaluate(() => { window.__long.length = 0; window.__events.length = 0; });

  const box = page.getByRole("searchbox").first();
  await box.click();
  // Zapytanie wklejone naraz (bez prefiksów „z”, „zx”…, które pasują do prawie wszystkiego i mierzyłyby rysowanie kart).
  // Czas w stronie: od wpisania do chwili, gdy lista ma oczekiwaną liczbę kart, plus dwie klatki.
  const until = (n) => page.evaluate(async (want) => {
    const t0 = performance.now();
    const deadline = t0 + 120_000;
    const count = () => document.querySelectorAll("[data-note-id]").length;
    if (want !== null) {
      while (count() !== want && performance.now() < deadline) await new Promise((r) => setTimeout(r, 10));
    } else {
      // Bez znanej liczby: czekamy, aż lista przestanie się zmieniać (5 × 50 ms), i odejmujemy to czekanie.
      let last = -1, stable = 0, settledAt = t0;
      while (stable < 5 && performance.now() < deadline) {
        await new Promise((r) => setTimeout(r, 50));
        const c = count();
        if (c === last) stable++; else { stable = 0; last = c; settledAt = performance.now(); }
      }
      return settledAt - t0;
    }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return performance.now() - t0;
  }, n);
  const fillAndWait = async (q, n) => { const p = until(n); await box.fill(q); return p; };
  await page.evaluate(() => { window.__long.length = 0; window.__events.length = 0; });
  // Siatka montuje karty przy przewijaniu, więc liczby trafień nie widać w DOM — czekamy na ustabilizowanie listy.
  const first = await fillAndWait("zxqvbn", null);
  // Kolejne zapytania (indeks już jest): zawężenie i powrót; lista zostaje mała, więc mierzymy wyszukiwanie, nie rysowanie.
  const followUp = [];
  for (const q of ["zxqvbn rura", "zxqvbn", "zxqvbn kocioł", "zxqvbn"]) { await page.waitForTimeout(300); followUp.push(await fillAndWait(q, null)); }
  const stats = await page.evaluate(() => {
    const ev = [...window.__events].sort((a, b) => a - b);
    return { inp: ev.length ? ev[Math.min(ev.length - 1, Math.ceil(0.98 * ev.length) - 1)] : 0, longMax: window.__long.reduce((a, b) => Math.max(a, b), 0), longSum: window.__long.reduce((a, b) => a + b, 0) };
  });
  await context.close();
  return { first, followUp: median(followUp), ...stats };
}

const out = { base, notes: COUNT, throttle: THROTTLE, runs: RUNS, tryb: {} };
for (const [name, w] of [["worker", true], ["glowny-watek", false]]) {
  const rows = [];
  for (let i = 0; i < RUNS; i++) { log(`${name} ${i + 1}/${RUNS}`); rows.push(await session(w)); }
  const col = (k) => round(median(rows.map((r) => r[k])));
  out.tryb[name] = { "pierwsze-zapytanie-ms": col("first"), "kolejne-zapytanie-ms": col("followUp"), "najgorsza-interakcja-ms": col("inp"), "najdluzsze-zadanie-ms": col("longMax"), "suma-dlugich-zadan-ms": col("longSum") };
}
await browser.close();
console.log(JSON.stringify(out, null, 2));
