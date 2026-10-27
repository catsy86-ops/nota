import { test, expect } from "@playwright/test";

// Logo na telefonie: animowany monogram w nagłówku w każdym widoku; pełny napis tylko w Notatkach.

test.use({ viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
});

test("telefon: monogram widoczny w Dziś, napis „NOTKI” ukryty poza Notatkami", async ({ page }) => {
  await page.goto("/dzis");
  await expect(page.locator(".n-mark-line").first()).toBeVisible();
  await expect(page.locator("header .notki-logo").first()).toBeHidden();
  await page.goto("/");
  await expect(page.locator("header .notki-logo").first()).toBeVisible();
});
