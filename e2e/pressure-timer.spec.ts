import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// B3.1 Minutnik próby szczelności: start z ciśnieniem i czasem, odczyty, powrót po zamknięciu okna i przeładowaniu
// (licznik od zapisanego startu), alert na koniec czasu, blokada zapisu wpisu w trakcie próby, wynik w protokole.

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 9, 22, 12, 0) });
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.study.tab.v1", "journal");
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.study.v1", JSON.stringify({ site: "Lipowa 5", journal: [] }));
  });
  await page.setViewportSize({ width: 390, height: 844 });
});

async function openTimer(page: Page) {
  const sheet = page.getByTestId("journal-entry-sheet");
  if (!(await sheet.isVisible())) await page.getByRole("button", { name: /^(Wpis|Dokończ wpis)$/ }).click();
  if (!(await sheet.getByTestId("pressure-test").isVisible())) {
    await sheet.getByRole("button", { name: "+ Próba" }).click();
    await sheet.getByRole("button", { name: "Dodaj protokół próby szczelności" }).click();
  }
  await sheet.getByRole("button", { name: /^Minutnik/ }).click();
  return page.getByTestId("pressure-test-timer");
}

test("minutnik: start, odczyt, powrót po przeładowaniu, alert, blokada zapisu i wynik w protokole", async ({ page }) => {
  await page.goto("/praca");
  const sheetOpen = page.getByRole("button", { name: /^Wpis$/ });
  await sheetOpen.click();
  const sheet = page.getByTestId("journal-entry-sheet");
  await sheet.getByLabel("Co się dzieje?").fill("Próba pionu wody");
  let timer = await openTimer(page);

  // Walidacja: zły czas nie startuje próby.
  await timer.getByTestId("timer-minutes").fill("abc");
  await timer.getByTestId("timer-start").click();
  await expect(timer.getByTestId("timer-error")).toContainText("Wpisz czas próby");

  await timer.getByRole("button", { name: "30 min" }).click();
  await timer.getByTestId("timer-start-bar").fill("6");
  await timer.getByTestId("timer-start").click();
  await expect(timer.getByTestId("timer-clock")).toHaveText("30:00");
  const axe = await new AxeBuilder({ page }).include("[data-testid='pressure-test-timer']").withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);

  await page.clock.runFor("15:00");
  await expect(timer.getByTestId("timer-clock")).toHaveText("15:00");
  await timer.getByTestId("timer-reading").fill("5,95");
  await timer.getByTestId("timer-add-reading").click();
  await expect(timer.getByTestId("pressure-chart")).toBeVisible();

  // Zamknięcie okna i przeładowanie strony: licznik liczy się od zapisanego startu.
  await page.keyboard.press("Escape");
  await expect(timer).toHaveCount(0);
  await expect(sheet.getByTestId("timer-badge")).toHaveText("· 15:00");
  await page.reload();
  await page.getByRole("button", { name: "Dokończ wpis" }).click();
  await expect(sheet.getByTestId("timer-badge")).toContainText("· 1");

  // Trwającej próby nie da się zapisać jako wpisu.
  await sheet.getByRole("button", { name: "Zapisz wpis" }).click();
  await expect(page.getByText("Próba szczelności trwa")).toBeVisible();
  await expect(sheet).toBeVisible();

  // Koniec czasu: alert (przewijamy tuż za koniec — toast żyje 15 s i nie może zniknąć w trakcie przewijania).
  await page.clock.runFor("15:01");
  await expect(page.getByText("Próba szczelności: czas minął").first()).toBeVisible();
  timer = await openTimer(page);
  await expect(timer.getByTestId("timer-clock")).toHaveText("Czas minął");

  // Wynik: ciśnienie końcowe → spadek, czas, „Nieszczelna”, wykres i odczyty w protokole.
  await timer.getByTestId("timer-finish").click();
  await timer.getByTestId("timer-reading").fill("5,9");
  await timer.getByTestId("timer-finish").click();
  await expect(timer).toHaveCount(0);
  const test2 = sheet.getByTestId("pressure-test");
  await expect(test2.getByLabel("Spadek [bar]")).toHaveValue("0,1");
  await expect(test2.getByLabel("Czas [min]")).toHaveValue("30");
  await expect(test2.getByRole("radio", { name: "Nieszczelna" })).toBeChecked();
  await expect(sheet.getByTestId("test-readings")).toContainText(/0 min 6 bar → 15 min 5,95 bar → 30(,\d+)? min 5,9 bar/);

  // Teraz wpis się zapisuje, a lista pokazuje odczyty.
  await sheet.getByRole("button", { name: "Zapisz wpis" }).click();
  await expect(sheet).toHaveCount(0);
  const entry = page.locator("[data-journal-entry]");
  await expect(entry.getByTestId("journal-test")).toContainText("nieszczelna");
  await expect(entry.getByTestId("journal-test-readings")).toHaveText(/^Odczyty: 0 min 6 bar → 15 min 5,95 bar → 30(,\d+)? min 5,9 bar$/);
});

test("minutnik: „Przerwij próbę” kasuje start i odczyty, a protokół zostaje", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("button", { name: /^Wpis$/ }).click();
  const timer = await openTimer(page);
  await timer.getByTestId("timer-start").click();
  await expect(timer.getByTestId("timer-clock")).toHaveText("30:00");
  await timer.getByTestId("timer-cancel").click();
  await expect(timer.getByTestId("timer-start")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("journal-entry-sheet").getByTestId("pressure-test")).toBeVisible();
  await expect(page.getByTestId("journal-entry-sheet").getByTestId("timer-badge")).toHaveCount(0);
});
