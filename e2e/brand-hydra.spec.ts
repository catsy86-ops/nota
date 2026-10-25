import { test, expect } from "@playwright/test";

// Nazwa i logo aplikacji to „hydra” (tytuł karty, logo w nagłówku i w pasku bocznym).

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
});

test("nazwa aplikacji: tytuł karty i logo „hydra”", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("hydra");
  await expect(page.getByRole("img", { name: "hydra" }).first()).toBeAttached();
});
