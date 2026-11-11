// Pomiar wydajności Pracy na emulowanym telefonie (plan B0.4, Faza 5). Bez prawdziwego telefonu: Pixel 7 + dławienie CPU ×4.
// Użycie: node scripts/measure-praca.mjs <seed.json> [adres=http://127.0.0.1:4174] [powtórzenia=5] [dławienie=4]
// Wymaga zbudowanej aplikacji pod adresem (`npm run build && npx vite preview --port 4174`). Wynik: JSON na stdout.
import { readFileSync } from "node:fs";
import { chromium, devices } from "@playwright/test";

const [seedFile, base = "http://127.0.0.1:4174", runsArg = "5", throttleArg = "4"] = process.argv.slice(2);
if (!seedFile) { console.error("Podaj plik seed (node scripts/seed-praca.mjs)."); process.exit(1); }
const RUNS = Number(runsArg);
const THROTTLE = Number(throttleArg);

const backup = JSON.parse(readFileSync(seedFile, "utf8"));
const dump = JSON.parse(backup.study);
const legacy = JSON.stringify({ site: dump.journal.at(-1)?.site ?? "", journal: dump.journal });

const log = (m) => process.stderr.write(`[pomiar] ${m}
`);
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const p75 = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil(0.75 * s.length) - 1)]; };
const round = (n) => (n === undefined || n === null ? null : Math.round(n));

const browser = await chromium.launch();
const result = { base, entries: dump.journal.length, sites: Object.keys(dump.sites).length, throttle: THROTTLE, runs: RUNS, scenarios: {} };

async function freshPage() {
  const context = await browser.newContext({ ...devices["Pixel 7"], serviceWorkers: "block" });
  const page = await context.newPage();
  await page.addInitScript((blob) => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.study.tab.v1", "journal");
    if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("kaczy.study.v1", blob); }
    // Długie zadania i zdarzenia (jak INP) zbierane w stronie.
    window.__long = []; window.__events = [];
    try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push(e.duration))).observe({ type: "longtask", buffered: true }); } catch { /* brak */ }
    try { new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (e.interactionId) window.__events.push(e.duration); })).observe({ type: "event", durationThreshold: 16, buffered: true }); } catch { /* brak */ }
  }, legacy);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: THROTTLE });
  return { context, page, cdp };
}

const heapMB = async (cdp) => { const { metrics } = await cdp.send("Performance.getMetrics"); return round(metrics.find((m) => m.name === "JSHeapUsedSize").value / 1_048_576); };

/**
 * Stuknięcie prawdziwą myszą po współrzędnych elementu (bez locatorów Playwrighta: `getByRole` liczy nazwy dostępności
 * po całym DOM pod dławieniem i zawyżałby czasy). Czas liczony w stronie: od `pointerdown` do dwóch klatek po tym, jak
 * warunek `ready` jest prawdziwy.
 */
async function tap(page, findRect, ready) {
  await page.evaluate(() => { window.__t0 = 0; window.addEventListener("pointerdown", () => { window.__t0 = performance.now(); }, { capture: true, once: true }); });
  const rect = await page.evaluate(findRect);
  if (!rect) throw new Error("brak elementu do stuknięcia");
  await page.mouse.click(rect.x, rect.y);
  return page.evaluate(async (readySrc) => {
    const ok = new Function(`return (${readySrc})()`);
    const deadline = performance.now() + 20_000;
    await new Promise((resolve, reject) => { const check = () => (ok() ? resolve() : performance.now() > deadline ? reject(new Error("timeout: warunek gotowości nie spełniony")) : requestAnimationFrame(check)); check(); });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return performance.now() - window.__t0;
  }, ready.toString());
}
const center = (el) => { if (!el) return null; el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };

/** Czas do dwóch klatek po wykonaniu akcji (jak „do pierwszej klatki”). */
const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(performance.now())))));

async function scenario(name, fn) {
  const samples = [];
  for (let i = 0; i < RUNS; i++) samples.push(await fn());
  const keys = Object.keys(samples[0]);
  result.scenarios[name] = Object.fromEntries(keys.map((k) => [k, { median: round(median(samples.map((s) => s[k]))), p75: round(p75(samples.map((s) => s[k]))), max: round(Math.max(...samples.map((s) => s[k]))) }]));
}

// 1. Otwarcie Pracy (Dziennik z całą historią): od nawigacji do pierwszego wpisu i do spokoju.
await scenario("otwarcie-dziennika", async () => {
  const { context, page, cdp } = await freshPage();
  const t0 = Date.now();
  await page.goto(`${base}/praca`);
  await page.locator("[data-journal-entry]").first().waitFor({ timeout: 60_000 });
  const toFirst = Date.now() - t0;
  await page.waitForTimeout(1500);
  const dom = await page.evaluate(() => document.getElementsByTagName("*").length);
  const entriesInDom = await page.locator("[data-journal-entry]").count();
  const heap = await heapMB(cdp);
  const long = await page.evaluate(() => window.__long.reduce((a, b) => Math.max(a, b), 0));
  await context.close();
  return { doPierwszegoWpisuMs: toFirst, wezlyDOM: dom, wpisyWDOM: entriesInDom, pamiecMB: heap, najdluzszeZadanieMs: long };
});

// 2. Karta budowy, 3. zakładki, 4. wyszukiwanie (indeks), 5. przewijanie — jedna sesja na powtórzenie.
await (async () => {
  const card = [], tabs = [], scroll = [], search = [], heapAfter = [], inp = [], tabsBy = {};
  // Jedna sesja po drugiej: strony w tle nie dostają requestAnimationFrame, więc nie wolno trzymać kilku naraz.
  for (let run = 0; run < RUNS; run++) {
    const { context, page, cdp } = await freshPage();
    await page.goto(`${base}/praca`);
    await page.locator("[data-journal-entry]").first().waitFor({ timeout: 60_000 });
    await page.waitForTimeout(1000);
    log("karta budowy");
    // karta budowy
    card.push(await tap(page,
      () => { const el = [...document.querySelectorAll("[data-testid=study-journal] button")].find((b) => (b.getAttribute("aria-label") || "").endsWith(": karta budowy")); if (!el) return null; el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; },
      () => !!document.querySelector("[data-testid=site-card]")));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    log("zakładki");
    // zakładki Pracy: każde przełączenie osobno (Budowa → Dziennik jest najcięższe: wraca cała oś)
    const seq = [["Budowa", "na-budowe"], ["Dziennik", "na-dziennik"], ["Nauka", "na-nauke"], ["Dziennik", "z-nauki-na-dziennik"]];
    for (const [name, key] of seq) {
      const find = new Function(`const el = [...document.querySelectorAll("[role=tab]")].find((t) => t.textContent.trim() === ${JSON.stringify(name)} && t.getBoundingClientRect().width > 0); if (!el) return null; el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };`);
      const ready = new Function(`return !![...document.querySelectorAll("[role=tab][aria-selected=true]")].find((t) => t.textContent.trim() === ${JSON.stringify(name)}) && ${name === "Dziennik" ? '!!document.querySelector("[data-journal-entry]")' : "true"};`);
      (tabsBy[key] ??= []).push(await tap(page, find, ready));
      await page.waitForTimeout(300);
    }
    tabs.push(0);

    log("przewijanie");
    // przewijanie Dziennika (długie zadania w trakcie)
    await page.evaluate(() => { window.__long.length = 0; });
    for (let k = 0; k < 8; k++) { await page.mouse.wheel(0, 1500); await page.waitForTimeout(80); }
    scroll.push(await page.evaluate(() => window.__long.reduce((a, b) => Math.max(a, b), 0)));

    log("wyszukiwanie");
    // wyszukiwanie: pierwsze zapytanie buduje indeks (B5.6); paleta jest ładowana leniwie
    await page.keyboard.press("Control+k");
    const input = page.locator("[cmdk-input]");
    if (await input.waitFor({ timeout: 20_000 }).then(() => true).catch(() => false)) {
      const s0 = await page.evaluate(() => performance.now());
      await input.fill("zawór");
      await page.waitForFunction(() => document.querySelectorAll("[cmdk-item]").length > 0, null, { timeout: 20_000 }).catch(() => undefined);
      search.push((await settle(page)) - s0);
    }
    inp.push(await page.evaluate(() => { const e = [...window.__events].sort((a, b) => a - b); return e.length ? e[Math.min(e.length - 1, Math.ceil(0.75 * e.length) - 1)] : 0; }));
    heapAfter.push(await heapMB(cdp));
    await context.close();
  }
  const stat = (a) => (a.length ? { median: round(median(a)), p75: round(p75(a)), max: round(Math.max(...a)) } : null);
  result.scenarios["karta-budowy-ms"] = { czas: stat(card) };
  for (const [k, v] of Object.entries(tabsBy)) result.scenarios[`zakladka-${k}-ms`] = { czas: stat(v) };
  result.scenarios["reakcja-na-stukniecie-p75-ms"] = { czas: stat(inp) };
  result.scenarios["przewijanie-najdluzsze-zadanie-ms"] = { czas: stat(scroll) };
  result.scenarios["wyszukiwanie-pierwsze-zapytanie-ms"] = { czas: stat(search) };
  result.scenarios["pamiec-po-sesji-MB"] = { czas: stat(heapAfter) };
})();

await browser.close();
console.log(JSON.stringify(result, null, 2));
