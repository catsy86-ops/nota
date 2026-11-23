import { test, expect } from "@playwright/test";

// S1.9: atrybut `data-privacy-cover` (ustawia `vaultAutoLock.ts` przy odblokowanym skarbcu i karcie w tle) rozmywa aplikację.
test("data-privacy-cover rozmywa #root, bez atrybutu nie ma filtra", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
  const filter = () => page.evaluate(() => getComputedStyle(document.getElementById("root")!).filter);
  expect(await filter()).toBe("none");
  await page.evaluate(() => document.documentElement.setAttribute("data-privacy-cover", ""));
  expect(await filter()).toMatch(/blur\(28px\)/);
  await page.evaluate(() => document.documentElement.removeAttribute("data-privacy-cover"));
  expect(await filter()).toBe("none");
});
