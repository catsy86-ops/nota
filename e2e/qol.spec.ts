import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

test("sekwencja „g, k” przechodzi do kosza, a „g, n” wraca do notatek", async ({ page }) => {
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("g");
  await page.keyboard.press("k");
  await expect(page).toHaveURL(/\/kosz$/);
  await page.keyboard.press("g");
  await page.keyboard.press("n");
  await expect(page).not.toHaveURL(/\/kosz$/);
});

test("„g” w polu tekstowym nie uruchamia nawigacji", async ({ page }) => {
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").click();
  await page.keyboard.type("gk");
  await expect(page).not.toHaveURL(/\/kosz$/);
});
