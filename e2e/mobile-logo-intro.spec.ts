import { test, expect } from "@playwright/test";

// Wejście logo na telefonie: poświata przy starcie (tylko telefon, bez ruchu przy ograniczonym ruchu).

test.use({ viewport: { width: 390, height: 844 } });

test("telefon: poświata wejścia jest w nagłówku", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/dzis");
  const animation = await page.locator(".logo-intro").first().evaluate((el) => getComputedStyle(el, "::after").animationName);
  expect(animation).toBe("logo-ring");
});

test("ograniczony ruch: poświata wyłączona", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/dzis");
  const display = await page.locator(".logo-intro").first().evaluate((el) => getComputedStyle(el, "::after").display);
  expect(display).toBe("none");
  await ctx.close();
});
