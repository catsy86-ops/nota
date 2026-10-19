import { test, expect, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

/** Notatka z przypomnieniem 23:59 w ostatnim dniu miesiąca (poza przeszłością, jak w reminders-calendar). */
async function addLateReminder(page: Page, title: string): Promise<string> {
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(title);
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  const card = page.locator("[data-note-id-wrap]", { hasText: title });
  await card.hover();
  await card.getByRole("button", { name: "Przypomnienie" }).click();
  const pickerDay = page.locator("[role=gridcell] button:not([disabled])").last();
  const dayNumber = (await pickerDay.textContent())!.trim();
  await pickerDay.click();
  await page.locator('input[type="time"]').fill("23:59");
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  return dayNumber;
}

test("oś godzin ustawia termin w jego godzinie, a lista zostaje domyślnym widokiem", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  const title = "Zamknac liste";
  const dayNumber = await addLateReminder(page, title);

  await page.getByRole("button", { name: /Kalendarz/ }).first().click();
  const grid = page.getByRole("grid", { name: /Kalendarz przypomnień/ });
  const cell = grid.getByRole("gridcell", { name: /1 termin/ });
  await expect(cell).toHaveAttribute("aria-label", new RegExp(`^[^,]+, ${dayNumber} `));
  await cell.click();

  // Domyślnie lista: brak osi.
  await expect(page.getByRole("list", { name: "Oś godzin dnia" })).toHaveCount(0);

  await page.getByRole("radio", { name: "Oś godzin" }).or(page.getByRole("button", { name: "Oś godzin" })).first().click();
  const axis = page.getByRole("list", { name: "Oś godzin dnia" });
  await expect(axis).toBeVisible();
  // Termin 23:59 rozszerza oś do północy, więc wiersz 23:00 niesie edycję.
  const lateRow = axis.getByRole("listitem").filter({ hasText: "23:00" });
  await expect(lateRow.getByRole("button", { name: `Edytuj termin: ${title}` })).toBeVisible();
});

test("na telefonie 360 px oś nie rozpycha strony", async ({ page }, testInfo) => {
  // Notatkę dodajemy na szerokim ekranie (na telefonie pole dodawania jest ukryte).
  await page.setViewportSize({ width: 1280, height: 1000 });
  await addLateReminder(page, "Bardzo dlugi tytul terminu zeby sprawdzic zawijanie w osi godzin");
  // Na telefonie widoki są w arkuszu „Więcej” — trasa `/kalendarz` jest prostsza (jak w mobile-layout).
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/kalendarz");
  const grid = page.getByRole("grid", { name: /Kalendarz przypomnień/ });
  await grid.getByRole("gridcell", { name: /1 termin/ }).click();
  await page.getByRole("radio", { name: "Oś godzin" }).or(page.getByRole("button", { name: "Oś godzin" })).first().click();
  await expect(page.getByRole("list", { name: "Oś godzin dnia" })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.getByRole("list", { name: "Oś godzin dnia" }).screenshot({ path: testInfo.outputPath("oś-360.png") });
});
