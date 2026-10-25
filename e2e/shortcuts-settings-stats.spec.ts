import { test, expect } from "@playwright/test";

// Skróty do Ustawień (Ctrl+,) i Statystyk (Alt+I) — QoL, punkt 7.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

test("Ctrl+, otwiera ustawienia", async ({ page }) => {
  await page.keyboard.press("Control+,");
  await expect(page.getByRole("dialog").first()).toBeVisible();
});

test("Alt+I otwiera statystyki", async ({ page }) => {
  await page.keyboard.press("Alt+i");
  await expect(page.getByRole("dialog").first()).toBeVisible();
});
