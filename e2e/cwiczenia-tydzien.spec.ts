import { test, expect } from "@playwright/test";

// Plan Ćwiczeń 3.2 (7 dni zgodności odżywki) i 3.5 (tydzień treningowy).

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("iphone"), "układ komputera — wszystkie sekcje naraz");
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/cwiczenia");
});

test("odżywka: odhaczenie dziś daje 1 z 7 w kropkach tygodnia", async ({ page }) => {
  const name = `Magnez ${Date.now()}`;
  // Formularz odżywki jest zwinięty do przycisku „Dodaj odżywkę” (plan 3.6).
  await page.getByRole("button", { name: "Dodaj odżywkę" }).first().click();
  await page.getByLabel("Nazwa odżywki").fill(name);
  await page.getByRole("button", { name: "Dodaj", exact: true }).click();
  await page.getByRole("checkbox", { name: `Wzięte: ${name}` }).click();
  await expect(page.getByRole("img", { name: "W ostatnich 7 dniach: 1 z 7" }).first()).toBeVisible();
});

test("trening: po zapisie serii wiersz „Ten tydzień” z dniem i seriami partii", async ({ page }) => {
  await page.getByLabel("Powtórki, seria 1").fill("10");
  await page.getByRole("button", { name: "Zapisz serie" }).click();
  const week = page.getByTestId("training-week");
  await expect(week).toContainText("1 trening");
  await expect(week).toContainText("serie:");
});
