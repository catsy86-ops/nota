import { test, expect } from "@playwright/test";

test("dziennik: po otwarciu arkusza wpisu fokus jest na jego tytule, a nie na polu tekstu", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.study.tab.v1", "journal");
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await page.getByRole("button", { name: "Dodaj wpis" }).first().click();
  await expect(page.getByRole("heading", { name: "Wpis z budowy" })).toBeFocused();
});
