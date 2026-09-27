import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

test("kalendarz otwiera się z paska bocznego i pozwala przechodzić po miesiącach", async ({ page }) => {
  await page.getByRole("button", { name: /Kalendarz/ }).first().click();

  const heading = page.getByRole("heading", { level: 2 });
  await expect(heading).toBeVisible();
  const startMonth = (await heading.textContent())?.trim();

  // Bieżący miesiąc nie potrzebuje skrótu „Dziś".
  await expect(page.getByRole("button", { name: "Wróć do bieżącego miesiąca" })).toHaveCount(0);

  await page.getByRole("button", { name: "Następny miesiąc" }).click();
  await expect(heading).not.toHaveText(startMonth!);

  const backToToday = page.getByRole("button", { name: "Wróć do bieżącego miesiąca" });
  await expect(backToToday).toBeVisible();
  await backToToday.click();
  await expect(heading).toHaveText(startMonth!);
});

test("kalendarz jest osiągalny z palety poleceń", async ({ page }) => {
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByPlaceholder(/Szukaj/i).first().fill("Kalendarz");
  // Klik w pozycję palety bywa niestabilny w trakcie jej animacji — Enter wybiera podświetloną.
  await expect(page.getByRole("option", { name: /Kalendarz/ })).toHaveCount(1);
  await page.keyboard.press("Enter");
  // Na stronie są dwa h1: nazwa aplikacji w pasku bocznym i tytuł widoku.
  await expect(page.getByRole("heading", { name: "Kalendarz", level: 1 })).toBeVisible();
});
