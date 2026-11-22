import { test, expect, type CDPSession, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { seedNotes } from "./helpers";

// Plan ruchu M2.1: pomiar klatek na telefonie (Pixel 7, procesor zdławiony ×4) na pięciu ścieżkach:
// przewijanie listy 300 notatek, otwarcie notatki, zmiana zakładki, otwarcie arkusza, przeciągnięcie karty.
// Klatki liczymy pętlą `requestAnimationFrame` (odstęp między klatkami) i dodatkowo Long Animation Frames
// (Chromium 123+), które podają klatki > 50 ms. Obserwatory wstrzykuje test — w aplikacji nie ma kodu pomiarowego.
// Pomiar na żądanie: `PERF=1 npx playwright test e2e/motion-frames.spec.ts --project=pixel-7`.
// Kryterium etapu M2: żadna ścieżka nie ma klatki > 50 ms (sprawdzane przy `FRAMES_STRICT=1`).

test.skip(!process.env.PERF, "pomiar tylko na żądanie (PERF=1)");

const CPU_RATE = Number(process.env.CPU_RATE ?? 4);
const NOW = new Date(2026, 10, 22, 12, 0).getTime();
const NOTES = Array.from({ length: 300 }, (_, i) => ({
  id: `n${i}`, title: `Notatka ${i}`,
  content: `Treść notatki numer ${i}. ${"Kilka słów, żeby kafel miał dwie, trzy linijki tekstu. ".repeat(1 + (i % 3))}`,
  color: i % 5 ? "default" : "yellow", pinned: false, archived: false, labels: i % 4 ? [] : ["dom"],
  order: i, createdAt: NOW - i * 60_000, updatedAt: NOW - i * 60_000,
}));

type Frames = { frames: number; over16: number; over33: number; over50: number; worst: number; loafWorst: number; loafCount: number; top: string[] };

async function installFrameProbe(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __frames: { deltas: number[]; loaf: number[]; who: Record<string, number>; on: boolean; last: number } };
    w.__frames = { deltas: [], loaf: [], who: {}, on: false, last: 0 };
    const tick = (t: number) => {
      const f = w.__frames;
      if (f.on && f.last) f.deltas.push(t - f.last);
      f.last = t;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    try {
      new PerformanceObserver((list) => {
        if (!w.__frames.on) return;
        for (const e of list.getEntries() as Array<PerformanceEntry & { scripts?: Array<{ duration: number; invoker?: string; sourceFunctionName?: string; sourceURL?: string }>; styleAndLayoutStart?: number; renderStart?: number }>) {
          w.__frames.loaf.push(e.duration);
          // Przypisanie: skrypty w klatce (wywołujący + funkcja) i styl/układ po nich.
          for (const sc of e.scripts ?? []) {
            const file = (sc.sourceURL ?? "").split("/").pop()?.replace(/-[\w-]{8}\.js$/, ".js") ?? "";
            const k = `${sc.invoker ?? "?"} → ${sc.sourceFunctionName || "?"} (${file})`;
            w.__frames.who[k] = (w.__frames.who[k] ?? 0) + sc.duration;
          }
          if (e.styleAndLayoutStart) w.__frames.who["[styl i układ]"] = (w.__frames.who["[styl i układ]"] ?? 0) + (e.startTime + e.duration - e.styleAndLayoutStart);
        }
      }).observe({ type: "long-animation-frame", buffered: false } as PerformanceObserverInit);
    } catch { /* brak LoAF */ }
  });
}

const start = (page: Page) => page.evaluate(() => {
  const f = (window as unknown as { __frames: { deltas: number[]; loaf: number[]; who: Record<string, number>; on: boolean; last: number } }).__frames;
  f.deltas = []; f.loaf = []; f.who = {}; f.last = 0; f.on = true;
});

const stop = (page: Page): Promise<Frames> => page.evaluate(() => {
  const f = (window as unknown as { __frames: { deltas: number[]; loaf: number[]; who: Record<string, number>; on: boolean } }).__frames;
  f.on = false;
  const d = f.deltas;
  // 16,7 ms = jedna klatka przy 60 Hz; próg 17,5 ms zostawia margines na drgania zegara rAF.
  return {
    frames: d.length,
    over16: d.filter((x) => x > 17.5).length,
    over33: d.filter((x) => x > 34).length,
    over50: d.filter((x) => x > 50).length,
    worst: Math.round(Math.max(0, ...d)),
    loafWorst: Math.round(Math.max(0, ...f.loaf)),
    loafCount: f.loaf.length,
    top: Object.entries(f.who).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${Math.round(v)} ms ${k}`),
  };
});

async function touchDrag(cdp: CDPSession, page: Page, x: number, y: number, dx: number, dy: number, steps: number, holdMs = 0) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  if (holdMs) await page.waitForTimeout(holdMs);
  for (let i = 1; i <= steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + (dx * i) / steps, y: y + (dy * i) / steps }] });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

test("ruch: klatki na pięciu ścieżkach przy procesorze zdławionym @mobile", async ({ page, browserName, isMobile }, testInfo) => {
  test.skip(browserName !== "chromium" || !isMobile, "dławienie CPU i dotyk przez CDP tylko w Chromium (pixel-7)");
  test.setTimeout(240_000);
  await installFrameProbe(page);
  await seedNotes(page, NOTES);
  // Ręczny porządek: na dotyku uchwyt przeciągania jest tylko wtedy (NoteCard).
  await page.addInitScript(() => localStorage.setItem("kaczy.viewPrefs.v1", JSON.stringify({ sortKey: "manual" })));

  await page.goto("/");
  const cards = page.locator("[data-note-id-wrap]");
  await expect(cards.first()).toBeVisible();
  // Rozgrzewka bez dławienia: pierwsze otwarcie notatki montuje edytor (jednorazowy koszt, osobny pomiar w web-vitals-phone).
  await cards.nth(1).getByRole("heading").tap({ position: { x: 8, y: 8 } });
  await page.waitForTimeout(800);
  await page.goBack();
  await expect(cards.first()).toBeVisible();
  await page.waitForTimeout(500);

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_RATE });
  const vw = await page.evaluate(() => window.innerWidth);
  const results: Record<string, Frames> = {};

  // 1. Przewijanie listy: trzy szybkie pociągnięcia palcem w górę i chwila na wyhamowanie.
  await start(page);
  // PROFILE=1: profil CPU przewijania do test-results (szukanie, kto zajmuje klatkę).
  if (process.env.PROFILE) { await cdp.send("Profiler.enable"); await cdp.send("Profiler.start"); }
  for (let i = 0; i < 3; i++) {
    await touchDrag(cdp, page, vw / 2, 650, 0, -450, 10);
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(600);
  results["przewijanie 300 notatek"] = await stop(page);
  if (process.env.PROFILE) {
    const { profile } = await cdp.send("Profiler.stop");
    writeFileSync(testInfo.outputPath("przewijanie.cpuprofile"), JSON.stringify(profile));
    console.log(`[profil] ${testInfo.outputPath("przewijanie.cpuprofile")}`);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);

  // 2. Otwarcie notatki stuknięciem w kafel.
  await start(page);
  await cards.first().getByRole("heading").tap({ position: { x: 8, y: 8 } });
  await page.waitForTimeout(1200);
  results["otwarcie notatki"] = await stop(page);
  await page.goBack();
  await expect(cards.first()).toBeVisible();
  await page.waitForTimeout(800);

  // 3. Zmiana zakładki: Notatki → Dziś → Notatki.
  await start(page);
  await page.getByRole("button", { name: "Dziś", exact: true }).first().tap();
  await expect(page).toHaveURL(/\/dzis/);
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: "Notatki", exact: true }).first().tap();
  await expect(cards.first()).toBeVisible();
  await page.waitForTimeout(900);
  results["zmiana zakładki"] = await stop(page);

  // 4. Otwarcie arkusza „Widok” i zamknięcie Escape.
  await start(page);
  await page.getByRole("button", { name: "Widok i kolumny" }).tap();
  await expect(page.getByRole("dialog", { name: "Widok" })).toBeVisible();
  await page.waitForTimeout(900);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(700);
  results["otwarcie arkusza"] = await stop(page);

  // 5. Przeciągnięcie karty: przytrzymanie uchwytu (TouchSensor, 200 ms) i przesunięcie w dół o dwie karty.
  const handle = cards.nth(0).locator("[data-drag-handle]");
  await expect(handle).toBeVisible();
  const box = (await handle.boundingBox())!;
  await start(page);
  await touchDrag(cdp, page, box.x + box.width / 2, box.y + box.height / 2, 0, 320, 20, 300);
  await page.waitForTimeout(900);
  results["przeciągnięcie karty"] = await stop(page);

  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });

  const lines = Object.entries(results).map(([name, r]) =>
    `${name}: ${r.frames} klatek, >16 ms ${r.over16}, >33 ms ${r.over33}, >50 ms ${r.over50}, najdłuższa ${r.worst} ms; LoAF: ${r.loafCount}, najdłuższa ${r.loafWorst} ms${r.top.map((t) => `\n    ${t}`).join("")}`);
  console.log(`[klatki] CPU ×${CPU_RATE}\n${lines.join("\n")}`);
  await testInfo.attach("klatki.json", { body: JSON.stringify({ cpu: CPU_RATE, results }, null, 2), contentType: "application/json" });

  for (const [name, r] of Object.entries(results)) {
    expect(r.frames, `${name}: pętla rAF działała`).toBeGreaterThan(10);
    if (process.env.FRAMES_STRICT) expect(r.worst, `${name}: najdłuższa klatka`).toBeLessThanOrEqual(50);
  }
});
