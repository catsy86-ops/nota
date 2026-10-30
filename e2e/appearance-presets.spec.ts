import { test, expect } from "@playwright/test";

// Zestawy wyglądu (plan motywów 2026-10-30, 1.3): „Budowa” zmienia styl bez przeładowania, „Cofnij” wraca.

test.use({ isMobile: true, hasTouch: true, viewport: { width: 390, height: 844 } });

test("zestaw Budowa stosuje się od razu i cofa się z komunikatu @mobile", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
  await page.getByRole("button", { name: "Więcej", exact: true }).click();
  await page.getByRole("button", { name: "Ustawienia" }).click();
  await page.getByRole("tab", { name: "Wygląd" }).click();
  const html = page.locator("html");
  await page.getByRole("button", { name: /^Budowa/ }).click();
  await expect(html).toHaveAttribute("data-skin", "odblask");
  await page.getByRole("button", { name: "Cofnij" }).click();
  await expect(html).toHaveAttribute("data-skin", "zeszyt");
});

test("własny slot: zapis bieżącego wyglądu i przywrócenie @mobile", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("kaczy.skin.v1", JSON.stringify("neon")));
  await page.reload();
  await page.getByRole("button", { name: "Więcej", exact: true }).click();
  await page.getByRole("button", { name: "Ustawienia" }).click();
  await page.getByRole("tab", { name: "Wygląd" }).click();
  await page.getByRole("button", { name: "Zapisz tu" }).nth(0).click();
  await expect(page.getByRole("button", { name: "Mój 1", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: /^Przywróć domyślny wygląd/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Przywróć" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-skin", "zeszyt");
  await page.getByRole("button", { name: "Mój 1", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-skin", "neon");
});
