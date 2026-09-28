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
