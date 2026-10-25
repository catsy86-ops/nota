import { test, expect } from "@playwright/test";

// Statystyki → „Ćwicz” (Etap 4 § D1): okno się zamyka, a Praca otwiera quiz.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/praca");
});

test("Ćwicz w statystykach zamyka okno i otwiera quiz", async ({ page }) => {
  await page.getByRole("button", { name: /Statystyki/ }).first().click();
  const stats = page.getByTestId("study-stats");
  await expect(stats).toBeVisible();
  await stats.getByRole("button", { name: "Ćwicz", exact: true }).click();
  await expect(stats).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Quiz" })).toBeVisible();
});
