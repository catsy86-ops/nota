import { test, expect } from "@playwright/test";

// Telefon: pasek boczny jest domyślnie zamknięty, więc wszystko, co żyło
// tylko w nim, było nieosiągalne z dolnej nawigacji.
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

test("„Więcej” → Ustawienia otwiera ustawienia przy zamkniętym pasku bocznym", async ({ page }) => {
  await page.getByRole("button", { name: "Więcej", exact: true }).click();
  await page.getByRole("button", { name: "Ustawienia" }).last().click();
  await expect(page.getByRole("dialog", { name: "Ustawienia" })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Dane/ })).toBeVisible();
});

test("Ustawienia na telefonie zajmują cały ekran i nie zmieniają wysokości przy zmianie zakładki", async ({ page }) => {
  await page.getByRole("button", { name: "Więcej", exact: true }).click();
  await page.getByRole("button", { name: "Ustawienia" }).last().click();
  const dialog = page.getByRole("dialog", { name: "Ustawienia" });
  await expect(dialog).toBeVisible();

  const heights: number[] = [];
  for (const tab of ["Wygląd", "Ogólne", "Dane", "Sync"]) {
    await page.getByRole("tab", { name: tab }).click();
    await expect(page.getByRole("tab", { name: tab })).toHaveAttribute("data-state", "active");
    heights.push(Math.round((await dialog.boundingBox())!.height));
  }
  expect(new Set(heights).size).toBe(1);
  expect(heights[0]).toBe(844);
});
