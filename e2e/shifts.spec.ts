import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Stały miesiąc bez świąt: w święto etykieta dnia zawiera jego nazwę
  // („1 listopada, Wszystkich Świętych, wolne”) i selektory nic by nie znalazły.
  await page.clock.setFixedTime(new Date("2026-10-07T10:00:00"));
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/grafik");
});

test("nanoszenie zmian liczy godziny, nocne i zarobek", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Grafik" })).toBeVisible();
  const summary = page.getByRole("region", { name: "Podsumowanie miesiąca" });
  await expect(summary).toContainText("0");

  // Pędzel „Dzień” jest domyślny — dwa dni po 8 h.
  await page.getByRole("button", { name: /^1 [a-ząćęłńóśźż]+, wolne$/ }).first().click();
  await page.getByRole("button", { name: /^2 [a-ząćęłńóśźż]+, wolne$/ }).first().click();
  // Noc na trzeci dzień.
  await page.getByRole("radio", { name: /Noc/ }).click();
  await page.getByRole("button", { name: /^3 [a-ząćęłńóśźż]+, wolne$/ }).first().click();

  await expect(summary.getByText("24", { exact: false }).first()).toBeVisible();
  await expect(summary).toContainText("Dni pracy3");
  await expect(summary).toContainText("W nocy8 h");

  await summary.getByLabel("Stawka za godzinę").fill("30");
  await expect(summary).toContainText("720,00");

  // Grafik przeżywa odświeżenie.
  await page.reload();
  await expect(page.getByRole("region", { name: "Podsumowanie miesiąca" })).toContainText("Dni pracy3");
});

test("ponowne stuknięcie tą samą zmianą czyści dzień", async ({ page }) => {
  const day = page.getByRole("button", { name: /^5 [a-ząćęłńóśźż]+, wolne$/ }).first();
  await day.click();
  await expect(page.getByRole("button", { name: /^5 [a-ząćęłńóśźż]+, Dzień/ }).first()).toBeVisible();
  await page.getByRole("button", { name: /^5 [a-ząćęłńóśźż]+, Dzień/ }).first().click();
  await expect(page.getByRole("button", { name: /^5 [a-ząćęłńóśźż]+, wolne$/ }).first()).toBeVisible();
});

test("własna zmiana z przerwą", async ({ page }) => {
  await page.getByRole("button", { name: "Dodaj rodzaj zmiany" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nazwa", { exact: true }).fill("Dwunastka");
  await dialog.getByLabel("Od", { exact: true }).fill("07:00");
  await dialog.getByLabel("Do", { exact: true }).fill("19:00");
  await dialog.getByLabel("Przerwa", { exact: true }).fill("30");
  await expect(dialog).toContainText("11 h 30 min");
  await page.getByRole("button", { name: "Zapisz zmianę" }).click();

  await expect(page.getByRole("radio", { name: /Dwunastka/ })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: /^10 [a-ząćęłńóśźż]+, wolne$/ }).first().click();
  await expect(page.getByRole("region", { name: "Podsumowanie miesiąca" })).toContainText("11 h 30 min");
});

test("cykl nakłada się na miesiąc i da się go cofnąć", async ({ page }) => {
  await page.getByRole("button", { name: "Cykl" }).click();
  const dialog = page.getByRole("dialog");
  // Domyślnie wybrany pierwszy zapisany cykl: 2× Dzień, 2× Noc, 4× wolne.
  await expect(dialog).toContainText("Kolejne dni cyklu (8)");
  await dialog.getByRole("button", { name: "Nałóż cykl" }).click();

  const summary = page.getByRole("region", { name: "Podsumowanie miesiąca" });
  await expect(summary).not.toContainText("Dni pracy0");
  await page.getByRole("button", { name: "Cofnij" }).click();
  await expect(summary).toContainText("Dni pracy0");
});

test("szczegóły dnia: dłużej niż w planie i notatka", async ({ page }) => {
  await page.getByRole("button", { name: /^1 [a-ząćęłńóśźż]+, wolne$/ }).first().click();
  await page.getByRole("radio", { name: "Szczegóły" }).click();
  await page.getByRole("button", { name: /^1 [a-ząćęłńóśźż]+, Dzień/ }).first().click();

  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Dodaj 15 minut" }).click();
  await dialog.getByRole("button", { name: "Dodaj 15 minut" }).click();
  await expect(dialog).toContainText("8 h 30 min");
  await dialog.getByLabel("Notatka").fill("zastępstwo");
  await dialog.getByRole("button", { name: "Zapisz dzień" }).click();

  await expect(page.getByRole("button", { name: /^1 [a-ząćęłńóśźż]+, Dzień.*odchylenie 30 min, notatka: zastępstwo/ }).first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Podsumowanie miesiąca" })).toContainText("8 h 30 min");
});

test("nieobecność obniża normę zamiast dodawać godziny", async ({ page }) => {
  const summary = page.getByRole("region", { name: "Podsumowanie miesiąca" });
  const normBefore = await summary.getByText(/h normy/).textContent();
  await page.getByRole("radio", { name: /Urlop/ }).click();
  await page.getByRole("button", { name: /^1 [a-ząćęłńóśźż]+, wolne$/ }).first().click();
  await expect(summary).toContainText("Dni pracy0");
  await expect(summary.getByText(/h normy/)).not.toHaveText(normBefore!);
});

test("eksport grafiku do kalendarza pobiera plik .ics", async ({ page }) => {
  await page.getByRole("button", { name: /^1 [a-ząćęłńóśźż]+, wolne$/ }).first().click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Do kalendarza (.ics)" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^grafik-\d{4}-\d{2}\.ics$/);
  const body = await (await download.createReadStream()).toArray();
  const text = Buffer.concat(body).toString("utf8");
  expect(text).toContain("SUMMARY:Zmiana: Dzień");
});
