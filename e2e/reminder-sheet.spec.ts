import { test, expect } from "@playwright/test";

// F2.1: na telefonie picker terminu otwiera się jako dolny arkusz, a pola mają co najmniej 44 px.

test.use({ viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

test("przypomnienie w kompozytorze otwiera dolny arkusz z polami ≥ 44 px", async ({ page }) => {
  await page.getByRole("button", { name: "Nowa notatka", exact: true }).click();
  await page.getByRole("button", { name: "Przypomnienie", exact: true }).first().click();

  const sheet = page.getByRole("dialog", { name: "Przypomnienie" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("group", { name: "Szybkie terminy" })).toBeVisible();

  const time = sheet.locator('input[type="time"]');
  await expect(time).toBeVisible();
  const h = (await time.boundingBox())?.height ?? 0;
  expect(h).toBeGreaterThanOrEqual(44);
});

// F2.2: chipy dnia i godziny; kalendarz tylko po „Wybierz…”.
test("chipy dnia i godziny ustawiają termin, kalendarz pokazuje się po „Wybierz…”", async ({ page }) => {
  await page.getByRole("button", { name: "Nowa notatka", exact: true }).click();
  await page.getByRole("button", { name: "Przypomnienie", exact: true }).first().click();
  const sheet = page.getByRole("dialog", { name: "Przypomnienie" });
  await expect(sheet).toBeVisible();

  // Na starcie bez wybranego dnia kalendarza nie ma.
  await expect(sheet.getByRole("grid")).toHaveCount(0);

  const dayGroup = sheet.getByRole("group", { name: "Dzień terminu" });
  await dayGroup.getByRole("button", { name: "Jutro", exact: true }).click();
  await expect(dayGroup.getByRole("button", { name: "Jutro", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(sheet.getByRole("grid")).toHaveCount(0);

  await dayGroup.getByRole("button", { name: "Wybierz…" }).click();
  await expect(sheet.getByRole("grid")).toBeVisible();

  const hourGroup = sheet.getByRole("group", { name: "Godzina terminu" });
  await hourGroup.getByRole("button", { name: "15:00" }).click();
  await expect(sheet.locator('input[type="time"]')).toHaveValue("15:00");
});

// F2.3: podgląd „Zapiszę: …” i pola aktualizują się przy wpisywaniu, bez zapisu.
test("wpisany tekst ustawia pola i podgląd, ale nie zapisuje terminu", async ({ page }) => {
  await page.getByRole("button", { name: "Nowa notatka", exact: true }).click();
  await page.getByRole("button", { name: "Przypomnienie", exact: true }).first().click();
  const sheet = page.getByRole("dialog", { name: "Przypomnienie" });
  await expect(sheet).toBeVisible();

  await sheet.getByPlaceholder("np. jutro 15:00, za 2h").fill("jutro 15:30");
  await expect(sheet.locator('input[type="time"]')).toHaveValue("15:30");
  await expect(sheet.getByTestId("reminder-preview")).toContainText("15:30");
  // Nic nie zapisane: arkusz nadal otwarty.
  await expect(sheet).toBeVisible();
});

// Q2: nowy termin zaczyna od ostatnio zapisanej godziny (bez historii — 09:00).
test("nowy termin zaczyna od ostatnio zapisanej godziny", async ({ page }) => {
  await page.evaluate(() => localStorage.setItem("kaczy.reminder.lastTime", "18:30"));
  await page.reload();
  await page.getByRole("button", { name: "Nowa notatka", exact: true }).click();
  await page.getByRole("button", { name: "Przypomnienie", exact: true }).first().click();
  const sheet = page.getByRole("dialog", { name: "Przypomnienie" });
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('input[type="time"]')).toHaveValue("18:30");
});
