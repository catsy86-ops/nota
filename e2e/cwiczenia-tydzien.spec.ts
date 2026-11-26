import AxeBuilder from "@axe-core/playwright";
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

test("C2.3: zapas po ostatniej serii — jedno stuknięcie, widoczny w „Ostatnio”", async ({ page }) => {
  await page.getByLabel("Powtórki, seria 1").fill("8");
  await page.getByLabel("Ciężar kg, seria 1").fill("20");
  const three = page.getByRole("button", { name: "Zapas 3 powtórzeń" });
  await three.click();
  await expect(three).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Zapisz serie" }).click();
  await expect(page.getByText(/Ostatnio .*8×20 kg \(zapas 3\)/)).toBeVisible();
  // Po zapisie wybór się czyści — następny wpis nie dziedziczy zapasu.
  await expect(three).toHaveAttribute("aria-pressed", "false");
});

test("C4.1: gwiazdka przypina posiłek, pigułka „Ulubione” zapisuje go jednym stuknięciem", async ({ page }) => {
  const name = `Kefir ${Date.now()}`;
  await page.getByLabel("Co zjedzono").fill(name);
  await page.getByLabel("Kalorie (kcal)").fill("120");
  await page.getByRole("button", { name: "Dodaj posiłek", exact: true }).click();
  const today = page.getByTestId("diet-today");
  await expect(today.getByText(name)).toHaveCount(1);
  await page.getByRole("button", { name: `Ulubiony: ${name}` }).click();
  const favorites = page.getByTestId("diet-favorites");
  await expect(favorites.getByRole("button", { name: `Zapisz ${name}` })).toBeVisible();
  await favorites.getByRole("button", { name: `Zapisz ${name}` }).click();
  await expect(today.getByText(name)).toHaveCount(2);
  // Odpięcie zdejmuje pigułkę; posiłki dnia zostają.
  await favorites.getByRole("button", { name: `Odepnij: ${name}` }).click();
  await expect(page.getByTestId("diet-favorites")).toHaveCount(0);
  await expect(today.getByText(name)).toHaveCount(2);
});

test("C2.2: „Zrobione” wpisuje serię jednym stuknięciem, −/+ zmieniają powtórzenia", async ({ page }) => {
  const quick = page.getByTestId("quick-set");
  await quick.getByRole("button", { name: "Powtórzenia: więcej" }).click();
  await quick.getByRole("button", { name: /^Zrobione:/ }).click();
  await expect(page.getByLabel("Powtórki, seria 1")).toHaveValue("11");
  await quick.getByRole("button", { name: /^Zrobione:/ }).click();
  await expect(page.getByLabel("Powtórki, seria 2")).toHaveValue("11");
  await page.getByRole("button", { name: "Zapisz serie" }).click();
  await expect(page.getByText(/Ostatnio .*11, 11/)).toBeVisible();
  const axe = await new AxeBuilder({ page }).include('[data-testid="quick-set"]').withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
});

test("C3.1: po zapisie treningu kalendarz regularności liczy dzień i ma opis dla czytnika", async ({ page }) => {
  await page.getByLabel("Powtórki, seria 1").fill("10");
  await page.getByRole("button", { name: "Zapisz serie" }).click();
  await expect(page.getByTestId("regularity-summary")).toContainText("trening 1 dzień");
  const grid = page.getByRole("img", { name: /Ostatnie 12 tygodni: trening 1 dzień/ });
  await expect(grid).toBeVisible();
  await expect(grid.locator("[data-level='1']")).toHaveCount(1);
  const axe = await new AxeBuilder({ page }).include('[data-testid="regularity-grid"]').withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
});

test("C3.4: pomiar obwodu pasa zapisuje się, pigułka pokazuje wynik, wykres ma opis", async ({ page }) => {
  const box = page.getByTestId("measures");
  await box.getByLabel("Obwód: Pas w centymetrach").fill("88,5");
  await box.getByRole("button", { name: "Zapisz pomiar" }).click();
  await expect(box.getByRole("button", { name: /Pas.*88,5/ })).toHaveAttribute("aria-pressed", "true");
  await expect(box.getByRole("img", { name: /Obwód: Pas, ostatnie 30 dni: 1 pomiar od/ })).toBeVisible();
  await expect(box.getByTestId("measures-list")).toContainText("88,5 cm");
  const axe = await new AxeBuilder({ page }).include('[data-testid="measures"]').withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
});
