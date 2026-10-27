import { test, expect } from "@playwright/test";

// Plan UI/UX 3.6: wracając do działu, stoimy tam, gdzie z niego wyszliśmy (przewinięcie per dział).
test("wracając do Notatek, przewinięcie wraca do miejsca wyjścia", async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.setViewportSize({ width: 1280, height: 500 });
  await page.goto("/");

  for (let i = 1; i <= 16; i++) {
    await page.getByText("Zapisz notatkę...").click();
    await page.getByPlaceholder("Tytuł").fill(`Notatka do przewijania ${i}`);
    await page.getByRole("button", { name: "Zapisz", exact: true }).click();
    await expect(page.getByRole("heading", { name: `Notatka do przewijania ${i}`, exact: true })).toBeVisible();
  }

  const scrollY = () => page.evaluate(() => Math.round(window.scrollY));
  await page.evaluate(() => window.scrollTo({ top: 300, behavior: "instant" as ScrollBehavior }));
  await expect.poll(scrollY).toBeGreaterThan(200);
  const saved = await scrollY();
  // Zapis po zatrzymaniu przewijania (debounce), zanim zmienimy dział.
  await page.waitForTimeout(300);

  await page.getByRole("button", { name: "Dziś", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Dziś" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Notatki", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Notatka do przewijania 16", exact: true })).toBeVisible();

  await expect.poll(scrollY, { timeout: 5000 }).toBeGreaterThan(saved - 40);
  expect(await scrollY()).toBeLessThanOrEqual(saved + 40);
});
