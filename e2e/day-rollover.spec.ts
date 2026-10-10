import { test, expect } from "@playwright/test";

// Zegar startuje tuż przed północą 7 → 8 października 2026 i płynie normalnie;
// `runFor` przeskakuje przez północ bez przeładowania strony.
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 9, 7, 23, 59, 0) });
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
});

test("Grafik przenosi „dziś” na nowy dzień po północy", async ({ page }) => {
  await page.goto("/grafik");
  const grid = page.getByRole("grid");
  await expect(grid.getByRole("button", { name: /^7 października, środa, dziś, wolne$/ })).toBeVisible();

  await page.clock.runFor(90_000);

  await expect(grid.getByRole("button", { name: /^8 października, czwartek, dziś, wolne$/ })).toBeVisible();
  await expect(grid.getByRole("button", { name: /^7 października, środa, wolne$/ })).toBeVisible();
});

test("widok Dziś przestaje pokazywać wczorajszą notatkę po północy", async ({ page }) => {
  await page.goto("/");
  const title = "Zebranie jutrzejsze";
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(title);
  await page.getByRole("button", { name: "Zamknij" }).click();
  await expect(page.locator("[data-note-id]").filter({ hasText: title })).toHaveCount(1);

  await page.keyboard.press("Alt+t");
  await expect(page).toHaveURL(/\/dzis$/);
  await expect(page.locator("[data-note-id]").filter({ hasText: title })).toHaveCount(1);

  await page.clock.runFor(120_000);

  await expect(page.locator("[data-note-id]").filter({ hasText: title })).toHaveCount(0);
});
