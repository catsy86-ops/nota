import { test, expect } from "@playwright/test";

// Edycja własnego pytania (Etap 4 § P6): treść się zmienia, a licznik quizu zostaje.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/praca");
});

test("własne pytanie można poprawić bez dodawania nowego", async ({ page }) => {
  await page.getByTestId("open-custom-questions").click();
  const dialog = page.getByTestId("custom-questions");
  await dialog.getByLabel("Pytanie", { exact: true }).fill("Ile zaworów na pionie?");
  await dialog.getByLabel("Poprawna odpowiedź").fill("Jeden");
  await dialog.getByLabel("Błędna odpowiedź 1").fill("Dwa");
  await dialog.getByLabel("Błędna odpowiedź 2").fill("Trzy");
  await dialog.getByLabel("Błędna odpowiedź 3").fill("Żaden");
  await dialog.getByRole("button", { name: "Dodaj pytanie" }).click();
  await expect(dialog.getByText("Ile zaworów na pionie?")).toBeVisible();

  await dialog.getByRole("button", { name: "Edytuj pytanie: Ile zaworów na pionie?" }).click();
  await expect(dialog.getByLabel("Pytanie", { exact: true })).toHaveValue("Ile zaworów na pionie?");
  await dialog.getByLabel("Pytanie", { exact: true }).fill("Ile zaworów na pionie instalacji?");
  await dialog.getByRole("button", { name: "Zapisz zmiany" }).click();
  await expect(page.getByText("Zapisano zmiany w pytaniu")).toBeVisible();
  await expect(dialog.getByText("Ile zaworów na pionie instalacji?")).toBeVisible();
  await expect(dialog.getByText("Ile zaworów na pionie?", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("open-custom-questions")).toContainText("(1)");
});
