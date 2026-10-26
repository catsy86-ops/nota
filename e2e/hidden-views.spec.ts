import { test, expect } from "@playwright/test";

// PW-3: ukryty dział znika z paska bocznego i z palety, dane i adres zostają.
test("ukrycie „Długi” w Ustawieniach → Wygląd: znika z paska, a /dlugi dalej działa", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/?settings=wyglad");
  await page.getByRole("switch", { name: "Długi" }).click();
  await expect(page.getByRole("switch", { name: "Długi" })).not.toBeChecked();
  await page.keyboard.press("Escape");

  const aside = page.getByRole("complementary");
  await expect(aside.getByRole("button", { name: "Długi", exact: true })).toHaveCount(0);
  await expect(aside.getByRole("button", { name: "Dziś", exact: true })).toBeVisible();

  await page.goto("/dlugi");
  await expect(page.getByRole("heading", { name: "Długi", level: 1 })).toBeVisible();
});
