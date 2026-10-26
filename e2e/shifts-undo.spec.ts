import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Stały miesiąc bez świąt (jak w shifts.spec.ts).
  await page.clock.setFixedTime(new Date("2026-10-07T10:00:00"));
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/grafik");
});

test("malowanie nadpisuje inną zmianę i daje Cofnij, który przywraca poprzednią", async ({ page }) => {
  const day = /^6 [a-ząćęłńóśźż]+, [a-ząćęłńóśźż]+, /;
  await page.getByRole("button", { name: new RegExp(`${day.source}wolne$`) }).first().click();
  await expect(page.getByRole("button", { name: new RegExp(`${day.source}Dzień`) }).first()).toBeVisible();

  await page.getByRole("radio", { name: /Noc/ }).click();
  await page.getByRole("button", { name: new RegExp(`${day.source}Dzień`) }).first().click();
  await expect(page.getByRole("button", { name: new RegExp(`${day.source}Noc`) }).first()).toBeVisible();

  await page.getByRole("button", { name: "Cofnij", exact: true }).click();
  await expect(page.getByRole("button", { name: new RegExp(`${day.source}Dzień`) }).first()).toBeVisible();
});
