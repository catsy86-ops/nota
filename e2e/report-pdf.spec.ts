import { test, expect } from "@playwright/test";

// P2.5: raport budowy jako plik PDF z menu „Więcej” (ta sama treść co tekst raportu).
test("raport: PDF do pobrania z nazwą od budowy i dat", async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 14, 12, 0).getTime());
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).getTime();
    const e = (id: string, when: number, kind: string, site: string, text: string) => ({ id, at: when, kind, topic: null, text, site, checked: [], images: [] });
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      journal: [
        e("a", at(14, 8, 15), "ok", "Lipowa 5", "Próba szczelności pionu"),
        e("b", at(14, 10, 20), "problem", "Lipowa 5", "Żółta rura przecieka"),
      ],
    }));
    localStorage.setItem("kaczy:shifts", JSON.stringify({ version: 2, days: { "2026-10-14": { type: "b" } } }));
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await page.getByTestId("study-journal").getByRole("button", { name: "Raport" }).click();
  const dialog = page.getByRole("dialog").first();
  await dialog.getByRole("button", { name: "Więcej" }).click();
  const download = page.waitForEvent("download", { timeout: 30000 });
  await page.getByRole("menuitem", { name: "PDF raportu (plik)" }).click();
  const file = await download;
  // Raport dnia: tytuł „Raport: Lipowa 5 — 14 października 2026”, prefiks „Raport:” nie wchodzi do nazwy.
  expect(file.suggestedFilename()).toBe("Raport - Lipowa 5 — 14 października 2026.pdf");
  const fs = await import("node:fs");
  const bytes = fs.readFileSync((await file.path())!);
  expect(bytes.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  expect(bytes.length).toBeGreaterThan(2000);
});
