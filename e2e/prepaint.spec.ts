import { test, expect } from "@playwright/test";

// Plan motywów 2026-10-30, 0.5: styl i jasność stoją na <html>, zanim wczyta się moduł aplikacji —
// bez mignięcia jasnego Zeszytu. Moduł `src/main.tsx` jest tu zablokowany, więc działa tylko `public/prepaint.js`.

test("ciemny Neon i jasna Miedź ustawione przed startem aplikacji", async ({ page }) => {
  await page.route(/\/src\/main\.tsx|\/assets\/index-[^/]+\.js$/, (r) => r.abort());
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.skin.v1", JSON.stringify("neon"));
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-skin", "neon");
  await expect(html).toHaveClass(/\bdark\b/);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#130a1b");

  await page.addInitScript(() => {
    localStorage.setItem("kaczy.skin.v1", JSON.stringify("miedz"));
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(html).toHaveAttribute("data-skin", "miedz");
  await expect(html).not.toHaveClass(/\bdark\b/);
});
