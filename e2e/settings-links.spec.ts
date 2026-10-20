import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Ustawienia widoku poza domyślnymi — tylko raz (sessionStorage), żeby przeładowanie ich nie nadpisało.
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded-settings-links")) return;
    sessionStorage.setItem("seeded-settings-links", "1");
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.viewPrefs.v1", JSON.stringify({ autosaveSeconds: 15, autoExportDays: 3 }));
  });
});

test("?settings=kopia otwiera Ustawienia na karcie Kopia i dane i czyści adres", async ({ page }) => {
  await page.goto("/?settings=kopia");
  const dialog = page.getByRole("dialog", { name: "Ustawienia" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("tab", { name: /Kopia i dane/ })).toHaveAttribute("aria-selected", "true");
  await expect(page).not.toHaveURL(/settings=/);
});

test("nieznana karta w ?settings= nie otwiera okna", async ({ page }) => {
  await page.goto("/?settings=nie-ma-takiej");
  await expect(page.getByRole("dialog", { name: "Ustawienia" })).toHaveCount(0);
});

test("reset w sekcji zmienia tylko ustawienia tej sekcji", async ({ page }) => {
  await page.goto("/?settings=ogolne");
  await expect(page.getByRole("dialog", { name: "Ustawienia" })).toBeVisible();

  // W Ogólne są dwa takie przyciski: „przypomnienia” (wyłączony, bo nic tam nie zmieniono) i „edytor” (po autosave).
  await page.getByRole("button", { name: "Przywróć domyślne w tej sekcji" }).last().click();
  await expect(page.getByRole("alertdialog")).toContainText("autosave");
  await page.getByRole("alertdialog").getByRole("button", { name: "Przywróć" }).click();

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("kaczy.viewPrefs.v1") ?? "{}"));
  expect(stored.autosaveSeconds).toBe(0);
  // Grupa „kopia” nie była resetowana — auto-backup zostaje na 3 dniach.
  expect(stored.autoExportDays).toBe(3);
});
