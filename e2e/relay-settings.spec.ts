import { test, expect } from "@playwright/test";

// Sekcja „Przekaźnik” w Ustawienia → Sync. Synchronizacja jest wyłączona, więc
// zapis adresu nie łączy się z żadnym serwerem.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
});

test("przekaźnik: odrzuca http do obcego hosta, zapisuje https i zapamiętuje po przeładowaniu", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Ustawienia" }).first().click();
  await page.getByRole("tab", { name: "Sync" }).click();
  await page.getByText("Przekaźnik (wyłączony)").click();

  await expect(page.getByText("Wyłączony.")).toBeVisible();
  const field = page.getByLabel("Adres przekaźnika");
  const save = page.getByRole("button", { name: "Zapisz przekaźnik" });

  await field.fill("http://sync.example.test");
  await expect(page.getByText("Adres musi zaczynać się od https://")).toBeVisible();
  await expect(save).toBeDisabled();

  await field.fill("https://sync.example.test/");
  await expect(page.getByText("Adres musi zaczynać się od https://")).toHaveCount(0);
  await expect(save).toBeEnabled();
  await save.click();

  await expect(page.getByText("Synchronizacja jest wyłączona", { exact: false })).toBeVisible();
  const stored = await page.evaluate(() => localStorage.getItem("kaczy.relay.v1"));
  expect(stored).toBe("https://sync.example.test");

  await page.reload();
  await page.getByRole("button", { name: "Ustawienia" }).first().click();
  await page.getByRole("tab", { name: "Sync" }).click();
  // Zapisany adres rozwija sekcję sam z siebie; kliknięcie w nagłówek by ją zwinęło.
  await expect(page.getByLabel("Adres przekaźnika")).toBeVisible();
  await expect(page.getByLabel("Adres przekaźnika")).toHaveValue("https://sync.example.test");
});

test("przekaźnik: pusty adres wyłącza i czyści zapis", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.relay.v1", "https://sync.example.test"));
  await page.goto("/");
  await page.getByRole("button", { name: "Ustawienia" }).first().click();
  await page.getByRole("tab", { name: "Sync" }).click();

  await page.getByRole("button", { name: "Wyczyść" }).click();
  await page.getByRole("button", { name: "Zapisz przekaźnik" }).click();
  const stored = await page.evaluate(() => localStorage.getItem("kaczy.relay.v1"));
  expect(stored).toBeNull();
});

test("przekaźnik: „Testuj” pokazuje brak odpowiedzi pod adresem, na którym nic nie słucha", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Ustawienia" }).first().click();
  await page.getByRole("tab", { name: "Sync" }).click();
  await page.getByText("Przekaźnik (wyłączony)").click();
  await page.getByLabel("Adres przekaźnika").fill("http://localhost:9");
  await page.getByRole("button", { name: "Testuj" }).click();
  await expect(page.getByText("Brak odpowiedzi — sprawdź adres i sieć")).toBeVisible();
});
