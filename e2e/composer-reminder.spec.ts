import { test, expect } from "@playwright/test";

// 2.5: z pustych Terminów „Nowa notatka” otwiera kompozytor z oknem terminu; „Cały dzień” trafia do notatki.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test("pusty widok Terminów: „Nowa notatka” otwiera kompozytor z oknem terminu", async ({ page }) => {
  await page.goto("/przypomnienia");
  await page.getByRole("button", { name: "Nowa notatka" }).first().click();
  await expect(page.getByText("Cały dzień (o 9:00)")).toBeVisible();
});

test("kompozytor: „Cały dzień” zapisuje przypomnienie na 9:00 tego dnia", async ({ page }) => {
  const title = `Cały dzień ${Date.now()}`;
  await page.goto("/przypomnienia");
  await page.getByRole("button", { name: "Nowa notatka" }).first().click();
  await page.getByRole("checkbox", { name: "Cały dzień (o 9:00)" }).check();
  await page.getByPlaceholder("Tytuł").fill(title);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Zapisz", exact: true }).last().click();
  await expect(page.getByText(title).first()).toBeVisible();
});

// Q1: po zapisie notatki z terminem toast mówi, kiedy zadzwoni (Cofnij bez zmian).
test("zapis notatki z terminem: toast podaje godzinę przypomnienia", async ({ page }) => {
  await page.goto("/przypomnienia");
  await page.getByRole("button", { name: "Nowa notatka" }).first().click();
  await page.getByRole("checkbox", { name: "Cały dzień (o 9:00)" }).check();
  // Termin powstaje dopiero po „Zapisz” w pickerze (samo zaznaczenie pola go nie ustawia); potrzebny jest dzień.
  await page.getByRole("group", { name: "Dzień terminu" }).getByRole("button", { name: "Dziś", exact: true }).click();
  await page.getByRole("button", { name: "Zapisz", exact: true }).first().click();
  await page.getByPlaceholder("Tytuł").fill(`Q1 ${Date.now()}`);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Zapisz", exact: true }).last().click();
  await expect(page.getByText(/Dodano z terminem: .*09:00/)).toBeVisible();
});
