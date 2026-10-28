import { test, expect } from "@playwright/test";

// P2.5: protokół odbioru jako plik PDF (nazwa firmy z Ustawień, nazwa pliku z budowy, rozmiar > 0).
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 14, 12, 0).getTime());
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.study.tab.v1", "journal");
    localStorage.setItem("kaczy.study.companyName.v1", JSON.stringify("Instalacje Kowalski"));
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      site: "Lipowa 5",
      journal: [
        { id: "a", at: Date.now() - 3600_000, kind: "ok", topic: null, text: "Próba szczelności pionu", site: "Lipowa 5", checked: [], images: [] },
        { id: "p", at: Date.now() - 1800_000, kind: "problem", topic: null, text: "Nieszczelna rewizja", site: "Lipowa 5", checked: [], images: [] },
      ],
    }));
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test("PDF protokołu: pobiera plik nazwany od budowy i z rozmiarem dokumentu", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await page.getByTestId("study-journal").getByRole("button", { name: "Lipowa 5: karta budowy" }).click();
  const card = page.getByTestId("site-card");
  const download = page.waitForEvent("download", { timeout: 30000 });
  await card.getByRole("button", { name: "PDF protokołu" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("Protokol odbioru - Lipowa 5.pdf");
  const path = await file.path();
  const fs = await import("node:fs");
  const bytes = fs.readFileSync(path!);
  expect(bytes.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  expect(bytes.length).toBeGreaterThan(2000);
});
