import { test, expect } from "@playwright/test";

// Świeżo dodany wpis w dzienniku jest podświetlony (oś czasu, Etap 3 § W5).

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 14, 12, 0).getTime());
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/praca");
});

test("nowy wpis dostaje podświetlenie na osi czasu", async ({ page }) => {
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await page.getByRole("button", { name: /^(Wpis|Dokończ wpis)$/ }).click();
  const sheet = page.getByTestId("journal-entry-sheet");
  await sheet.getByLabel("Co się dzieje?").fill("Świeży wpis do podświetlenia");
  await sheet.getByRole("button", { name: "Zapisz wpis" }).click();
  await expect(page.locator('[data-fresh="true"]').filter({ hasText: "Świeży wpis do podświetlenia" })).toHaveCount(1);
});
