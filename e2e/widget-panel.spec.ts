import { test, expect } from "@playwright/test";

// Widżet „Na dziś” (adres /widget): terminy na dziś i szybkie dodanie notatki, bez siatki wszystkich notatek.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
});

test("widżet: pusty dzień i „Nowa notatka” otwiera kompozytor", async ({ page }) => {
  await page.goto("/widget");
  await expect(page.getByTestId("widget-panel")).toBeVisible();
  await expect(page.getByText("Nic na dziś. Dobry moment, żeby coś zapisać.")).toBeVisible();
  await page.getByTestId("widget-panel").getByRole("button", { name: "Nowa notatka" }).click();
  await expect(page.getByPlaceholder("Tytuł")).toBeVisible();
});
