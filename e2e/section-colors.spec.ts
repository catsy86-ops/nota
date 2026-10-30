import { test, expect } from "@playwright/test";

// Kolory działów (plan motywów 2026-10-30, 3.4): przełącznik w Wyglądzie zmienia grubość kreski pod tytułem.

test.use({ viewport: { width: 1280, height: 800 } });

test("wyraźne podkreślenia działów i powrót do subtelnych @smoke", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.appearance.advanced.v1", "1");
  });
  await page.goto("/grafik");
  await page.getByRole("button", { name: "Ustawienia" }).first().click();
  await page.getByRole("tab", { name: "Wygląd" }).click();
  const colors = page.getByRole("radiogroup", { name: "Kolory działów" });
  await colors.getByRole("radio", { name: "Wyraźne" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-sections", "bold");
  await colors.getByRole("radio", { name: "Subtelne" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-sections", /.+/);
});
