import { test, expect } from "@playwright/test";

// Z-16.2 krok 0 (`docs/plan-dane-lokalne.md` §2.3): pomiar przywracania kopii z 2000 notatek przy 4× spowolnionym
// procesorze — długie zadania (ponad 50 ms) w trakcie. Poza zwykłym przebiegiem: `PERF=1 npx playwright test e2e/restore-perf.spec.ts`.

test.skip(!process.env.PERF, "pomiar tylko na żądanie (PERF=1)");

test("przywracanie 2000 notatek: długie zadania", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "CDP tylko w Chromium");
  test.setTimeout(240_000);
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    // Bez przeładowania po przywróceniu (BackupSettings, 1,2 s po komunikacie) — lista zadań ginęłaby razem ze stroną.
    const st = window.setTimeout;
    window.setTimeout = ((fn: TimerHandler, ms?: number, ...rest: unknown[]) =>
      (typeof fn === "function" && /reload\(\)/.test(String(fn)) ? 0 : st(fn, ms, ...rest))) as typeof window.setTimeout;
    const tasks: number[] = [];
    (window as unknown as { __long: number[] }).__long = tasks;
    new PerformanceObserver((list) => { for (const e of list.getEntries()) tasks.push(Math.round(e.duration)); }).observe({ type: "longtask", buffered: true });
  });
  await page.goto("/");
  const cdp = await page.context().newCDPSession(page);
  const now = Date.now();
  const notes = Array.from({ length: 2000 }, (_, i) => ({
    id: `perf-${i}`, title: `Notatka ${i}`, content: `Treść notatki ${i}. `.repeat(25), color: "default", pinned: false, archived: false,
    trashed: false, trashedAt: null, labels: i % 5 ? [] : ["praca"], reminder: null, priority: "none", images: [], checklist: [],
    folderId: null, order: i, createdAt: now - i * 1000, updatedAt: now - i * 1000,
  }));
  const backup = JSON.stringify({ version: 3, exportedAt: now, notes, folders: [], labels: ["praca"] });

  await page.getByRole("button", { name: "Ustawienia" }).first().click();
  await page.getByRole("tab", { name: "Kopia i dane" }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Przywróć z pliku kopii" }).click();
  await (await chooser).setFiles({ name: "perf.json", mimeType: "application/json", buffer: Buffer.from(backup) });
  await expect(page.getByText("Przywrócić tę kopię?")).toBeVisible();

  await page.evaluate(() => { (window as unknown as { __long: number[] }).__long.length = 0; });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const t0 = Date.now();
  const download = page.waitForEvent("download").catch(() => null);
  await page.getByRole("button", { name: "Przywróć kopię" }).click();
  await download;
  await expect(page.getByText(/Przywrócono kopię/)).toBeVisible({ timeout: 200_000 });
  const ms = Date.now() - t0;
  // Zadania po komunikacie (dorysowanie listy) też się liczą.
  await page.waitForTimeout(3000);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  const long = await page.evaluate(() => (window as unknown as { __long: number[] }).__long.slice().sort((a, b) => b - a));
  console.log(`PERF restore 2000: ${ms} ms, long tasks: ${long.length}, top: ${long.slice(0, 10).join(", ")}`);
});
