import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test("praca: „Do notatki” z tematu nie tworzy drugiej notatki", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Tablica" }).click();
  const button = page.getByRole("button", { name: /: do notatki$/ }).first();
  await button.click();
  await expect(page.getByText(/Dodano notatkę „Nauka: /)).toBeVisible();
  await button.click();
  await expect(page.getByText(/już istnieje/)).toBeVisible();

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /^Nauka: / })).toHaveCount(1);
});
