import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

// Plan motywów 4.1 (T-4): własny motyw — styl bazowy i suwaki odcienia w Zaawansowanych; generator nakłada
// tokeny inline na `html`, „Przywróć styl” je zdejmuje.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.skin.v1", JSON.stringify("miedz"));
  });
  await page.goto("/");
});

test("własny motyw: suwak zmienia akcent, przywrócenie zdejmuje", async ({ page }) => {
  await page.getByRole("button", { name: "Ustawienia" }).click();
  await page.getByRole("tab", { name: "Wygląd" }).click();
  await page.getByRole("button", { name: /^Pokaż: kształt/ }).click();

  await expect(page.getByRole("heading", { name: "Własny motyw (eksperyment)" })).toBeVisible();
  await page.getByRole("button", { name: "Zrób własny motyw z „Beton i patyna”" }).click();

  const accent = page.getByRole("slider", { name: /Akcent/ });
  await accent.focus();
  await page.keyboard.press("End");
  await expect(page.getByText("Kontrast tekstu w porządku (AA).")).toBeVisible();
  const primary = await page.evaluate(() => document.documentElement.style.getPropertyValue("--primary"));
  expect(primary).toMatch(/^oklch\(/);

  // Suwaki i komunikat przechodzą audyt WCAG 2.2 AA (tak jak reszta `a11y.spec.ts`).
  const axe = await new AxeBuilder({ page }).include("#wyglad-zaawansowane").withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);

  await page.getByRole("button", { name: "Przywróć styl „Beton i patyna”" }).click();
  await expect(page.getByRole("button", { name: "Zrób własny motyw z „Beton i patyna”" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.style.getPropertyValue("--primary"))).toBe("");
});
