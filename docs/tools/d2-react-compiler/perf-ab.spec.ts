import { test, expect, type Page, type BrowserContext } from "@playwright/test";

// Tymczasowy pomiar A/B D-2 (React Compiler). Nie część e2e; wynik do docs/.
// A = build z kompilatorem (port 4173), B = bazowy (port 4174). Naprzemiennie, świeże konteksty, CPU 4×.

const NOW = Date.now();
const note = (i: number) => ({
  id: `p${i}`, title: `Notatka ${i}`, content: `Treść ${i}: lorem ipsum dolor sit amet ${i % 7}`,
  color: "default", pinned: false, archived: false, trashed: false, trashedAt: null, labels: [], reminder: null,
  priority: "none", images: [], checklist: [], folderId: null, order: i, createdAt: NOW - i * 1000, updatedAt: NOW - i * 1000,
});
const NOTES = Array.from({ length: 300 }, (_, i) => note(i + 1));
const TARGETS = [
  { name: "A-kompilator", url: "http://localhost:4173" },
  { name: "B-bazowy", url: "http://localhost:4174" },
];
const ROUNDS = 8;

type Sample = { target: string; round: number; inp: number; blocking: number };
const samples: Sample[] = [];

async function seed(context: BrowserContext) {
  await context.addInitScript((notes) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy-notes-data", JSON.stringify(notes));
  }, NOTES);
}

async function scenario(page: Page): Promise<{ inp: number; blocking: number }> {
  await page.evaluate(() => {
    const w = window as unknown as { __ev: number[]; __long: number[]; __obs?: PerformanceObserver[] };
    w.__ev = [];
    w.__long = [];
    w.__obs?.forEach((o) => o.disconnect());
    const ev = new PerformanceObserver((list) => { for (const e of list.getEntries()) w.__ev.push(e.duration); });
    ev.observe({ type: "event", durationThreshold: 16 } as PerformanceObserverInit);
    const lt = new PerformanceObserver((list) => { for (const e of list.getEntries()) w.__long.push(e.duration); });
    lt.observe({ type: "longtask" });
    w.__obs = [ev, lt];
  });
  const search = page.getByLabel("Szukaj w notatkach").locator("visible=true").first();
  await search.click();
  await page.keyboard.type("lorem ipsum 3", { delay: 40 });
  await page.waitForTimeout(300);
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");
  await page.waitForTimeout(500);
  return page.evaluate(() => {
    const w = window as unknown as { __ev: number[]; __long: number[] };
    return {
      inp: Math.max(0, ...w.__ev),
      blocking: w.__long.reduce((s, d) => s + Math.max(0, d - 50), 0),
    };
  });
}

test("A/B: wyszukiwanie w 300 notatkach, CPU 4×", async ({ browser }) => {
  test.setTimeout(900_000);
  for (let round = 0; round < ROUNDS; round++) {
    for (const t of TARGETS) {
      const context = await browser.newContext();
      await seed(context);
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await page.goto(`${t.url}/`);
      await expect.poll(() => page.locator("[data-note-id-wrap]").count(), { timeout: 60_000 }).toBeGreaterThan(50);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await page.waitForTimeout(500);
      const r = await scenario(page);
      samples.push({ target: t.name, round: round + 1, inp: r.inp, blocking: r.blocking });
      console.log(`[ab] ${t.name} runda ${round + 1}: INP ${Math.round(r.inp)} ms, blokowanie ${Math.round(r.blocking)} ms`);
      await context.close();
    }
  }
  const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const p75 = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length * 0.75)];
  for (const t of TARGETS) {
    const xs = samples.filter((s) => s.target === t.name);
    console.log(`[ab] PODSUMOWANIE ${t.name}: INP med ${Math.round(med(xs.map((s) => s.inp)))} p75 ${Math.round(p75(xs.map((s) => s.inp)))} | blok med ${Math.round(med(xs.map((s) => s.blocking)))} p75 ${Math.round(p75(xs.map((s) => s.blocking)))} (n=${xs.length})`);
  }
});
