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

test("paleta: „Krój: Lexend” zmienia krój od razu i zapamiętuje go", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
  await page.keyboard.press("Control+k");
  await page.locator("[cmdk-input]").fill("krój lexend");
  await page.getByRole("option", { name: /Krój: Lexend/ }).click();
  await expect(page.getByText("Krój: Lexend")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("kaczy.font.v1"))).toContain("lexend");
});

test("paleta: „Zrób kopię teraz” pobiera plik kopii", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
  await page.keyboard.press("Control+k");
  await page.locator("[cmdk-input]").fill("zrób kopię");
  const download = page.waitForEvent("download");
  await page.getByRole("option", { name: /Zrób kopię teraz/ }).click();
  expect((await download).suggestedFilename()).toMatch(/\.json$/);
});
