import { test, expect } from "@playwright/test";

// Faza 1 planu Kalendarza: pole dnia w edycji terminu (telefon nie przeciąga chipów).

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

test("w edycji terminu pole „Dzień” przenosi go na inny dzień", async ({ page }) => {
  const title = `Zadzwonić ${Date.now()}`;
  await page.getByRole("button", { name: /Kalendarz/ }).first().click();

  // Termin na dziś przez panel dnia.
  await page.getByRole("button", { name: "Dodaj termin" }).click();
  await page.getByLabel("Treść nowej notatki z terminem").fill(title);
  await page.getByRole("button", { name: "Utwórz notatkę z terminem" }).click();

  const chip = page.getByRole("button", { name: new RegExp(`^Edytuj termin: ${title}`) });
  await expect(chip).toBeVisible();
  // Etykieta czytnika podaje godzinę (1e planu).
  await expect(chip).toHaveAccessibleName(/\d{2}:\d{2}$/);

  await chip.click();
  const dialog = page.getByRole("dialog", { name: "Termin przypomnienia" });
  await expect(dialog).toBeVisible();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const iso = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  await dialog.getByLabel("Dzień przypomnienia").fill(iso);
  await dialog.getByRole("button", { name: "Zapisz termin" }).click();

  // Termin zniknął z dzisiejszego panelu; pozostaje wpis w pasku „Najbliższe”.
  await expect(chip).toHaveCount(0);
  await expect(page.getByText("Brak terminów tego dnia.")).toBeVisible();
});
