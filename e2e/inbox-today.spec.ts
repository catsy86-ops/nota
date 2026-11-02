import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
});

test("skrzynka: Enter zapisuje bez pytań, licznik w pasku bocznym i „Cofnij”", async ({ page }) => {
  await page.goto("/skrzynka");
  const input = page.getByLabel("Przechwyć do skrzynki");
  await expect(input).toBeVisible();

  await input.fill("Kupić uszczelki do pralki");
  await input.press("Enter");
  await expect(page.getByText("Zapisano w skrzynce")).toBeVisible();
  await expect(input).toHaveValue("");
  await expect(page.locator("[data-note-id]").filter({ hasText: "Kupić uszczelki do pralki" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: /Skrzynka/ }).first()).toContainText("1");

  await page.getByRole("button", { name: "Cofnij" }).click();
  await expect(page.locator("[data-note-id]").filter({ hasText: "Kupić uszczelki do pralki" })).toHaveCount(0);
});

test("skrzynka: pusty tekst nic nie tworzy", async ({ page }) => {
  await page.goto("/skrzynka");
  await page.getByLabel("Przechwyć do skrzynki").press("Enter");
  await expect(page.getByText("Zapisano w skrzynce")).toHaveCount(0);
  await expect(page.getByText("Skrzynka jest pusta")).toBeVisible();
});

test("dziś: karta zmiany i sekcja przypomnień na pustym koncie", async ({ page }) => {
  await page.goto("/dzis");
  await expect(page.getByTestId("today-card")).toBeVisible();
  await expect(page.getByTestId("today-shift")).toContainText("Dziś nie ma zmiany w grafiku.");
  await expect(page.getByTestId("today-due")).toContainText("Nic nie czeka na dziś.");
  await page.getByRole("button", { name: /Grafik/ }).first().click();
  await expect(page).toHaveURL(/\/grafik$/);
});

test("Dziś: wiersz „Skrzynka: N do posortowania” z „Porządkuj” (plan Dziś 4.4)", async ({ page }) => {
  await page.goto("/skrzynka");
  const input = page.getByLabel("Przechwyć do skrzynki");
  await input.fill(`Do Dziś ${Date.now()}`);
  await input.press("Enter");
  await expect(page.getByText("Zapisano w skrzynce")).toBeVisible();
  await page.goto("/dzis");
  const row = page.getByTestId("today-personal");
  await expect(row).toContainText("Skrzynka: 1 do posortowania");
  await row.getByRole("button", { name: "Porządkuj" }).click();
  await expect(page).toHaveURL(/\/skrzynka/);
});
