import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
});

test("telefon: Dziś ma ciaśniejsze odstępy między kartami (16 px) @mobile", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("iphone"), "tylko układ telefonu");
  await page.goto("/dzis");
  const main = page.locator("main").first();
  await expect(main).toBeVisible();
  await expect(main).toHaveCSS("row-gap", "16px");
});

test("komputer: Dziś zachowuje odstępy 40 px", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("iphone"), "układ komputera");
  await page.goto("/dzis");
  const main = page.locator("main").first();
  await expect(main).toBeVisible();
  await expect(main).toHaveCSS("row-gap", "40px");
});
