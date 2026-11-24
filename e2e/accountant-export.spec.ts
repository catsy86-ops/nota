import { test, expect } from "@playwright/test";

// R3.5 „Dla księgowej”: ZIP z hasłem (AES) z kilometrówką i fakturami za miesiąc.

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 10, 5, 12, 0).getTime());
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      journal: [{ id: "a", at: new Date(2026, 9, 3, 9).getTime(), kind: "ok", topic: null, text: "Start", site: "Lipowa 5", checked: [], images: [] }],
    }));
    localStorage.setItem("kaczy.study.mileage.v1", JSON.stringify({
      rate: 1, entries: [{ id: "k1", date: new Date(2026, 9, 3, 12).getTime(), siteIds: ["lipowa-5"], distance: 42, rate: 1 }],
    }));
  });
});

test("poprzedni miesiąc domyślnie, słabe hasło blokuje, ZIP się pobiera", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await page.getByTestId("accountant-open").click();
  const dialog = page.getByTestId("accountant-export");
  await expect(dialog.getByTestId("accountant-month")).toHaveValue("2026-10");
  await expect(dialog.getByTestId("accountant-count")).toContainText("0 faktur · 1 dzień w kilometrówce");
  const save = dialog.getByTestId("accountant-save");
  await dialog.getByLabel(/Hasło do ZIP-a/).fill("krótkie");
  await expect(save).toBeDisabled();
  await dialog.getByLabel(/Hasło do ZIP-a/).fill("Księgowa-październik-2026!");
  const download = page.waitForEvent("download");
  await save.click();
  expect((await download).suggestedFilename()).toBe("ksiegowa-2026-10.zip");

  await page.getByTestId("accountant-open").click();
  await page.getByTestId("accountant-export").getByTestId("accountant-month").fill("2026-08");
  await expect(page.getByTestId("accountant-export").getByTestId("accountant-count")).toContainText("nie ma faktur ani kilometrówki");
});
