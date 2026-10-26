import { test, expect } from "@playwright/test";

// U-4: „Co nowego” pokazuje się tylko po zmianie wersji; pierwsze uruchomienie tylko zapamiętuje wersję.
test("pierwsze uruchomienie: bez dymka; zapamiętana stara wersja: dymek z listą zmian", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Co nowego" })).toHaveCount(0);

  await page.evaluate(() => localStorage.setItem("kaczy.lastSeenVersion.v1", JSON.stringify("2026.01.01")));
  await page.reload();
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Co nowego w wersji 2026.10.26" })).toBeVisible();
});
