import { test, expect } from "@playwright/test";

// Gęstość interfejsu (plan motywów 2026-10-30, 4.2): na komputerze „Kompakt” zmniejsza odstępy,
// na telefonie (dotyk) nie zmienia celów dotyku.

test("kompakt zmniejsza odstępy na komputerze @smoke", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.uiDensity.v1", JSON.stringify("compact"));
  });
  await page.goto("/");
  const spacing = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--spacing").trim());
  expect(spacing).toBe(".2rem");
});

test.describe("dotyk", () => {
test.use({ isMobile: true, hasTouch: true, viewport: { width: 390, height: 844 } });

test("na telefonie gęstość nie zmienia --spacing @mobile", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.uiDensity.v1", JSON.stringify("compact"));
  });
  await page.goto("/");
  const spacing = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--spacing").trim());
  expect(spacing).toBe(".25rem");
});
});
