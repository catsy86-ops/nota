import { test, expect } from "@playwright/test";

// U-3: zgodność ze starszą wersją wyłącza się sama po 30 dniach bez urządzeń w starym pokoju.
test("włączona zgodność bez urządzeń 30 dni: wyłącza się i pokazuje komunikat", async ({ page }) => {
  const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
  await page.addInitScript((since: number) => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.sync.v1", JSON.stringify({ enabled: false, code: null, signaling: [], legacyRoom: true, shortCodeDropped: false }));
    localStorage.setItem("kaczy.legacyRoomIdle.v1", JSON.stringify({ since, seenAt: null }));
  }, thirtyOneDaysAgo);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/?settings=sync");
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Zgodność ze starszą wersją wyłączona" })).toBeVisible();
  const prefs = await page.evaluate(() => JSON.parse(localStorage.getItem("kaczy.sync.v1") ?? "{}"));
  expect(prefs.legacyRoom).toBe(false);
});
