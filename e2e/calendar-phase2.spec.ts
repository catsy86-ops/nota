import { test, expect } from "@playwright/test";

// Plan Kalendarza, faza 2d (cały dzień w dialogu) i faza 3a (tydzień na telefonie).

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

test("termin „Cały dzień” w dialogu nie pokazuje godziny i stoi na 9:00", async ({ page }) => {
  const title = `Dzień wolny ${Date.now()}`;
  await page.getByRole("button", { name: /Kalendarz/ }).first().click();
  await page.getByRole("button", { name: "Dodaj termin" }).click();
  await page.getByLabel("Treść nowej notatki z terminem").fill(title);
  await page.getByRole("checkbox", { name: "Cały dzień" }).check();
  await expect(page.getByLabel("Godzina przypomnienia")).toHaveCount(0);
  await page.getByRole("button", { name: "Utwórz notatkę z terminem" }).click();

  const chip = page.getByRole("button", { name: new RegExp(`^Edytuj termin: ${title}, 09:00`) });
  await expect(chip).toBeVisible();
});

test.describe("telefon", () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test("przełącznik Miesiąc / Tydzień zamienia siatkę na pasek tygodnia", async ({ page }) => {
    await page.goto("/kalendarz");
    const month = page.getByRole("button", { name: "Miesiąc", exact: true });
    const week = page.getByRole("button", { name: "Tydzień", exact: true });
    await expect(month).toHaveAttribute("aria-pressed", "true");

    await week.click();
    await expect(week).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("region", { name: "Ten tydzień" })).toBeVisible();
    await expect(page.getByRole("grid")).toBeHidden();

    await month.click();
    await expect(page.getByRole("grid")).toBeVisible();
  });
});
