import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

test("Zamień na listę i z powrotem na tekst w edytorze notatki", async ({ page }) => {
  const title = `E2E-konwersja ${Date.now()}`;
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(title);
  await page.getByPlaceholder("Treść notatki...").fill("jabłka\ngruszki");
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(page.getByText("Zapisz notatkę...")).toBeVisible();

  await page.getByText(title).click();
  const body = page.getByPlaceholder("Treść notatki...");
  await page.getByRole("button", { name: "Zamień na listę" }).click();
  await expect(page.getByLabel("Odhacz: jabłka")).toBeVisible();
  await expect(body).toHaveValue("");

  await page.getByLabel("Odhacz: gruszki").click();
  await page.getByRole("button", { name: "Zamień na tekst" }).click();
  await expect(body).toHaveValue("- [ ] jabłka\n- [x] gruszki");
  await expect(page.getByLabel(/^Odhacz: |^Odznacz: /)).toHaveCount(0);
});

test("Zamień na listę w pasku nowej notatki", async ({ page }) => {
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Treść notatki...").fill("- mleko\n- [x] chleb");
  await page.getByRole("button", { name: "Zamień na listę" }).click();
  await expect(page.getByLabel("Odhacz: mleko")).toBeVisible();
  await expect(page.getByLabel("Odznacz: chleb")).toBeVisible();
  await expect(page.getByRole("button", { name: "Zamień na listę" })).toHaveCount(0);
});

test("lista: Enter dodaje pozycję pod spodem, Tab robi podzadanie, Backspace na pustej usuwa, „Usuń ukończone” ma Cofnij", async ({ page }) => {
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Treść notatki...").fill("mleko\nchleb");
  await page.getByRole("button", { name: "Zamień na listę" }).click();

  const mleko = page.locator('input[data-checklist-item]').first();
  await expect(mleko).toHaveValue("mleko");
  await mleko.click();
  await page.keyboard.press("Enter");
  await expect(page.locator('input[data-checklist-item]').nth(1)).toBeFocused();
  await page.keyboard.type("masło");
  await expect(page.locator('input[data-checklist-item]')).toHaveCount(3);
  await expect(page.locator('input[data-checklist-item]').nth(1)).toHaveValue("masło");

  // Tab wcina pod poprzednią pozycją.
  await page.keyboard.press("Tab");
  await expect(page.locator('input[data-checklist-item]').nth(1).locator("xpath=ancestor::div[contains(@class,'ml-6')]")).toHaveCount(1);

  // Pusta pozycja znika po Backspace.
  await page.keyboard.press("Enter");
  await expect(page.locator('input[data-checklist-item]').nth(2)).toBeFocused();
  await page.keyboard.press("Backspace");
  await expect(page.locator('input[data-checklist-item]')).toHaveCount(3);

  // „Usuń ukończone” czyści odhaczone i daje Cofnij.
  await page.getByLabel("Odhacz: chleb").click();
  await page.getByRole("button", { name: "Usuń ukończone" }).click();
  await expect(page.getByLabel(/Odznacz: chleb/)).toHaveCount(0);
  await page.getByRole("button", { name: "Cofnij" }).click();
  await expect(page.getByLabel("Odznacz: chleb")).toBeVisible();
});
