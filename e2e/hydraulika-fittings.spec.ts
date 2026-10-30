import { test, expect } from "@playwright/test";

// Kształtki na dolnym pasku w Hydraulice (plan motywów 2026-10-30, 3.1): ikony lucide znikają, kształtki są widoczne;
// w innych stylach odwrotnie.

test.use({ viewport: { width: 390, height: 844 } });

test("w Hydraulice kształtki zamiast ikon lucide; w Zeszycie odwrotnie @mobile", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    // Styl startowy tylko przy pierwszym wejściu — przeładowanie nie może go nadpisać.
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.skin.v1", JSON.stringify("hydraulika"));
  });
  await page.goto("/");
  const nav = page.locator("nav").last();
  await expect(nav.locator(".hydro-fitting").first()).toBeVisible();
  await expect(nav.locator(".nav-lucide").first()).toBeHidden();
  await page.evaluate(() => localStorage.setItem("kaczy.skin.v1", JSON.stringify("zeszyt")));
  await page.reload();
  await expect(page.locator("nav").last().locator(".hydro-fitting").first()).toBeHidden();
  await expect(page.locator("nav").last().locator(".nav-lucide").first()).toBeVisible();
});
