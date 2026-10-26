import { test, expect } from "@playwright/test";

// D-2: karty opcjonalne na Dziś wyłącza się w Ustawieniach → Wygląd; zapis tylko na tym urządzeniu.
test("wyłączenie „Trening mózgu” na Dziś ukrywa kartę i zostaje po odświeżeniu", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/?settings=wyglad");
  await page.getByRole("switch", { name: "Trening mózgu" }).click();
  await expect(page.getByRole("switch", { name: "Trening mózgu" })).not.toBeChecked();
  await page.keyboard.press("Escape");

  await page.goto("/dzis");
  await expect(page.getByRole("heading", { name: "Dziś", level: 1 }).first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Trening mózgu" })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("region", { name: "Trening mózgu" })).toHaveCount(0);
});
