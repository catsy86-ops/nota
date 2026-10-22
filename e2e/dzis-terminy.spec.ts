import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

test("dziś: „Jutro rano” przy zaległym terminie przenosi go z listy", async ({ page }) => {
  const title = `Zaległe ${Date.now()}`;
  await page.goto("/kalendarz");
  await page.getByRole("button", { name: "Dodaj termin" }).click();
  await page.getByLabel("Treść nowej notatki z terminem").fill(title);
  // Godzina 00:01 dzisiaj — jest już po niej, więc termin od razu trafia do zaległych.
  await page.getByLabel("Godzina przypomnienia").fill("00:01");
  await page.getByRole("button", { name: /Utwórz notatkę z terminem/ }).click();

  await page.goto("/dzis");
  const due = page.getByTestId("today-due");
  await expect(due).toContainText(title);
  await due.getByRole("button", { name: "Jutro rano" }).first().click();
  await expect(due).toContainText("Nic nie czeka na dziś.");
});

test("kalendarz: „Za godzinę” w panelu dnia odkłada termin i pokazuje cofnięcie", async ({ page }) => {
  const title = `Kalendarz ${Date.now()}`;
  await page.goto("/kalendarz");
  await page.getByRole("button", { name: "Dodaj termin" }).click();
  await page.getByLabel("Treść nowej notatki z terminem").fill(title);
  await page.getByLabel("Godzina przypomnienia").fill("00:01");
  await page.getByRole("button", { name: /Utwórz notatkę z terminem/ }).click();

  const panel = page.getByRole("region", { name: "Terminy wybranego dnia" });
  await expect(panel).toContainText(title);
  await panel.getByRole("button", { name: "Za godzinę" }).click();
  await expect(page.getByText("Przesunięto o godzinę")).toBeVisible();
});
