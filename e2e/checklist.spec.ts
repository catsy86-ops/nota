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
  await page.getByRole("button", { name: "Zamknij" }).click();
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
