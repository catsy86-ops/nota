import { test, expect } from "@playwright/test";

// Powłoka 2.5: paleta przenosi od razu na kartę Ustawień.
test("paleta: „Połącz urządzenie” otwiera Ustawienia na karcie Sync", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
  await page.keyboard.press("Control+k");
  await page.locator("[cmdk-input]").fill("połącz urządzenie");
  await page.getByRole("option", { name: /Połącz urządzenie/ }).click();
  await expect(page.getByRole("tab", { name: "Sync" })).toHaveAttribute("aria-selected", "true");
});
