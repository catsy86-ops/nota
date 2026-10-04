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

test("na dotyku akcje kafla są schowane za „Więcej opcji”", async ({ page }) => {
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill("Kafel na telefonie");
  await page.getByRole("button", { name: "Zamknij" }).click();
  const card = page.locator("[data-note-idx]").filter({ hasText: "Kafel na telefonie" });
  await expect(card.getByRole("button", { name: "Przypnij" })).toBeHidden();
  await card.getByRole("button", { name: "Więcej opcji" }).click();
  await expect(card.getByRole("button", { name: "Przypnij" })).toBeVisible();
  await expect(card.getByRole("button", { name: "Duplikuj" })).toBeVisible();
});

test("Przypomnienia mają własną zakładkę w dolnym pasku, Archiwum jest w „Więcej”", async ({ page }) => {
  const nav = page.getByRole("navigation");
  await nav.getByRole("button", { name: "Przypomnienia" }).click();
  await expect(page.getByRole("heading", { name: "Przypomnienia", level: 1 })).toBeVisible();
  await expect(nav.getByRole("button", { name: "Przypomnienia" })).toHaveAttribute("aria-current", "page");

  await page.getByRole("button", { name: "Więcej", exact: true }).click();
  await page.getByRole("button", { name: "Archiwum" }).last().click();
  await expect(page.getByRole("heading", { name: "Archiwum", level: 1 })).toBeVisible();
});
