import { test, expect } from "@playwright/test";

// Kształtki we wpisie (tylko sztuki): pigułki podpowiedzi, −/+, suma w raporcie budowy.

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 14, 12, 0).getTime());
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.study.tab.v1", "journal");
    const w = window as unknown as Record<string, unknown>;
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (t: string) => { w.__copied = t; } } });
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      site: "Lipowa 5",
      journal: [{ id: "old", at: new Date(2026, 9, 14, 8).getTime(), kind: "ok", topic: null, text: "Rano", site: "Lipowa 5", checked: [], images: [], fittings: [{ name: "Mufa 32", qty: 3 }, { name: "Kolano 16", qty: 2 }] }],
    }));
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test("kształtki: podpowiedź z poprzednich wpisów, −/+, lista wpisów i suma w raporcie", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("button", { name: /^(Wpis|Dokończ wpis)$/ }).click();
  const sheet = page.getByTestId("journal-entry-sheet");
  await sheet.getByRole("button", { name: /^(\+ |✓ )?Kształtki$/ }).click();
  await sheet.getByRole("button", { name: "Dodaj kształtki" }).click();
  const box = sheet.getByTestId("fittings");
  // Pierwsza (pusta) pozycja + podpowiedzi: najpierw nazwy używane wcześniej.
  await box.getByRole("button", { name: "Mufa 32" }).click();
  await box.getByLabel("Kształtka 1: nazwa").fill("Kolano 16");
  await box.getByRole("button", { name: "Kolano 16: więcej" }).click();
  await box.getByRole("button", { name: "Kolano 16: więcej" }).click();
  await box.getByRole("button", { name: "Mufa 32: więcej" }).click();
  await box.getByRole("button", { name: "Mufa 32: mniej" }).click();
  // Przy 1 sztuce „−” usuwa pozycję.
  await box.getByRole("button", { name: "Kolano 20" }).click();
  await box.getByRole("button", { name: "Usuń kształtkę Kolano 20" }).click();
  await expect(box.getByTestId("fitting-qty")).toHaveText(["3", "1"]);
  await sheet.getByRole("button", { name: "Zapisz wpis" }).click();
  await expect(sheet).toHaveCount(0);

  await expect(page.getByTestId("journal-fittings").first()).toHaveText("Kolano 16 × 3, Mufa 32 × 1");

  await page.getByTestId("study-journal").getByRole("button", { name: "Raport" }).click();
  const dialog = page.getByTestId("journal-report");
  const sum = dialog.locator("[data-report-fittings-sum]");
  await expect(sum.getByRole("row", { name: /Kolano 16/ })).toContainText("5 szt.");
  await expect(sum.getByRole("row", { name: /Mufa 32/ })).toContainText("4 szt.");
  await dialog.getByRole("button", { name: "Więcej" }).click();
  await page.getByRole("menuitem", { name: "Kopiuj tekst" }).click();
  const copied = await page.evaluate(() => (window as unknown as { __copied: string }).__copied);
  expect(copied).toContain("## Kształtki (suma)\n- Kolano 16: 5 szt.\n- Mufa 32: 4 szt.");
  expect(copied).toContain("Kształtki: Kolano 16 × 3, Mufa 32 × 1");
});
