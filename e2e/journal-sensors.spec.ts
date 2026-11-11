import { test, expect } from "@playwright/test";

// B3.4–B3.6: poziomnica, kod ze skanera/NFC i streszczenie AI zapisane we wpisie są widoczne na liście,
// wracają do formularza edycji i przeżywają zapis zmian (wcześniej ginęły przy zapisie wpisu).
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 22, 12, 0).getTime());
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.study.tab.v1", "journal");
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      site: "Lipowa 5",
      journal: [{
        id: "a", at: new Date(2026, 9, 22, 9, 5).getTime(), kind: "ok", topic: null, text: "Pion w łazience",
        site: "Lipowa 5", checked: [], images: [], level: 1.2, barcode: "5901234123457", summary: "Pion sprawdzony, spadek w normie.",
      }],
    }));
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test("wpis z poziomicą, kodem i streszczeniem: lista, edycja i zapis zmian", async ({ page }) => {
  await page.goto("/praca");
  const entry = page.locator("[data-journal-entry]");
  await expect(entry.getByTestId("journal-sensors")).toContainText("Spadek 2,1% (1,2°) · Kod: 5901234123457");
  await expect(entry.getByTestId("journal-summary")).toHaveText("Streszczenie: Pion sprawdzony, spadek w normie.");

  await entry.getByRole("button", { name: "Opcje wpisu" }).click();
  await page.getByRole("menuitem", { name: "Edytuj wpis" }).click();
  const sheet = page.getByTestId("journal-entry-sheet");
  await expect(sheet.getByText("Spadek: 2,1% (1,2°)")).toBeVisible();

  await sheet.getByLabel("Co się dzieje?").fill("Pion w łazience, poprawiony");
  await sheet.getByRole("button", { name: "Zapisz zmiany" }).click();
  await expect(sheet).toHaveCount(0);

  await expect(entry).toContainText("Pion w łazience, poprawiony");
  await expect(entry.getByTestId("journal-sensors")).toContainText("Spadek 2,1% (1,2°) · Kod: 5901234123457");
  await expect(entry.getByTestId("journal-summary")).toBeVisible();
});
