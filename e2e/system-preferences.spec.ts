import { test, expect } from "@playwright/test";

// Plan UI/UX 3.12: wysoki kontrast zmienia krawędzie i tekst pomocniczy; wymuszone kolory
// zachowują widoczny fokus (pierścień to cień, a ten znika w trybie wysokiego kontrastu).
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

test("prefers-contrast: more zmienia krawędź i tekst pomocniczy w motywie", async ({ page }) => {
  const token = (name: string) => page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);
  const borderBefore = await token("--border");
  const mutedBefore = await token("--muted-foreground");

  await page.emulateMedia({ contrast: "more" });
  await expect.poll(() => token("--border")).not.toBe(borderBefore);
  expect(await token("--muted-foreground")).not.toBe(mutedBefore);
});

test("wymuszone kolory: fokus z klawiatury ma widoczny obrys systemowy", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await page.keyboard.press("Tab");
  const focused = page.locator(":focus-visible").first();
  await expect(focused).toBeVisible();
  const outline = await focused.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { style: cs.outlineStyle, width: cs.outlineWidth };
  });
  expect(outline.style).toBe("solid");
  expect(outline.width).toBe("2px");
});
