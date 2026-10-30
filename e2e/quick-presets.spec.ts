import { test, expect } from "@playwright/test";

// Szybkie zestawy (plan motywów 1.3): przytrzymanie przełącznika jasności otwiera okienko zestawów;
// zwykłe stuknięcie dalej przełącza jasność.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
});

test("telefon: przytrzymanie „Tryb ciemny” w Więcej → zestaw Noc, Cofnij @mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Więcej", exact: true }).click();
  const tile = page.getByRole("button", { name: "Tryb ciemny" });
  await tile.hover(); // przewija arkusz do kafelka i stawia kursor na nim
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  const dialog = page.getByTestId("quick-presets");
  await expect(dialog).toBeVisible();
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
  await dialog.getByRole("button", { name: /^Noc/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-skin", "zorza");
  await page.getByRole("button", { name: "Cofnij" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-skin", "zeszyt");
});

test("komputer: prawy przycisk na przełączniku jasności otwiera zestawy, klik dalej przełącza", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Tryb ciemny" }).first();
  await toggle.click({ button: "right" });
  const dialog = page.getByTestId("quick-presets");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /^Budowa/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-skin", "odblask");
  await page.getByRole("button", { name: "Cofnij" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-skin", "zeszyt");
  await toggle.click();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
});
