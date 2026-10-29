import { test, expect } from "@playwright/test";

// Ramki i poświata są nakładane przy starcie aplikacji, nie dopiero po otwarciu Ustawień.

test("zapisane ramki i poświata działają od pierwszego ekranu", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.glow.v1", JSON.stringify({ strength: "soft", color: "green" }));
    localStorage.setItem("kaczy.frames.look.v1", JSON.stringify({ color: "copper", surface: "mint" }));
  });
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue("--glow-mul"))).toBe("0.5");
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue("--glow-color"))).toBe("#22c55e");
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue("--border"))).toContain("#b45309");
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue("--card"))).toContain("oklch");
});
