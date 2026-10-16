import { test, expect, type Page } from "@playwright/test";

// Etapy budowy w karcie: odhaczanie z datą, własny etap, usuwanie z „Cofnij”, postęp przy budowie i w raporcie.

async function reloadWhenSaved(page: Page) {
  await expect(page.getByText("Zapisano", { exact: true })).toBeVisible();
  await page.reload();
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 14, 12, 0).getTime());
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.study.tab.v1", "journal");
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      site: "Lipowa 5",
      journal: [{ id: "a", at: new Date(2026, 9, 14, 9).getTime(), kind: "ok", topic: null, text: "Kanalizacja pod posadzką", site: "Lipowa 5", checked: [], images: [] }],
    }));
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test("etapy: odhaczenie, własny etap, usunięcie z Cofnij, postęp przy budowie i w raporcie, po przeładowaniu", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Dziennik" }).click();
  const journal = page.getByTestId("study-journal");
  // Bez odhaczania nie ma postępu przy budowie — lista domyślna jeszcze nieużywana.
  await expect(journal.locator("[data-site-progress]")).toHaveCount(0);
  await journal.getByRole("button", { name: "Lipowa 5: karta budowy" }).click();

  const card = page.getByTestId("site-card");
  const stages = card.getByTestId("site-stages");
  await expect(stages.getByTestId("site-stages-progress")).toHaveText("0/7");
  await expect(stages).toContainText("Następny: Kanalizacja podposadzkowa");

  await stages.getByRole("checkbox", { name: /Kanalizacja podposadzkowa/ }).click();
  await expect(stages.getByRole("checkbox", { name: /Kanalizacja podposadzkowa/ })).toHaveAttribute("aria-checked", "true");
  await expect(stages.getByTestId("site-stages-progress")).toHaveText("1/7");
  await expect(stages).toContainText("Następny: Rozprowadzenie wody");
  await expect(stages.getByRole("checkbox", { name: /Kanalizacja podposadzkowa/ })).toContainText("14.10");

  await stages.getByLabel("Nowy etap").fill("Kocioł i grzejniki");
  await stages.getByRole("button", { name: "Dodaj" }).click();
  await expect(stages.getByTestId("site-stages-progress")).toHaveText("1/8");

  await stages.getByRole("button", { name: "Usuń etap: Odbiór" }).click();
  await expect(stages.getByTestId("site-stages-progress")).toHaveText("1/7");
  await page.locator("[data-sonner-toast]").filter({ hasText: "Usunięto etap „Odbiór”" }).getByRole("button", { name: "Cofnij" }).click();
  await expect(stages.getByTestId("site-stages-progress")).toHaveText("1/8");

  // Raport z karty: sekcja etapów i postęp w podsumowaniu.
  await card.getByRole("button", { name: "Raport", exact: true }).click();
  const report = page.getByTestId("journal-report");
  const section = report.locator("[data-report-stages]");
  await expect(section).toContainText("Etapy (1/8)");
  await expect(section.locator("[data-stage-done]")).toHaveCount(1);
  await expect(report).toContainText("postęp: 1/8 etapów");
  await page.keyboard.press("Escape");

  await expect(journal.locator("[data-site-progress]")).toHaveText("etapy 1/8");
  await reloadWhenSaved(page);
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await expect(page.getByTestId("study-journal").locator("[data-site-progress]")).toHaveText("etapy 1/8");
  await page.getByTestId("study-journal").getByRole("button", { name: "Lipowa 5: karta budowy" }).click();
  await expect(page.getByTestId("site-card").getByTestId("site-stages")).toContainText("Kocioł i grzejniki");
});

test("wpis „Zrobione” podsuwa następne etapy — stuknięcie odhacza, „Cofnij” przywraca", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("button", { name: /^(Wpis|Dokończ wpis)$/ }).click();
  const sheet = page.getByTestId("journal-entry-sheet");
  await sheet.getByRole("radio", { name: "Zrobione" }).click();
  const chips = sheet.getByTestId("journal-stage-chips").getByRole("button");
  await expect(chips).toHaveText(["Kanalizacja podposadzkowa", "Rozprowadzenie wody", "Piony i podejścia kanalizacji"]);

  // Odhaczony etap przypina się do wpisu — zamiast pigułek pasek „Etap: …”.
  await sheet.getByRole("button", { name: "Odhacz etap: Kanalizacja podposadzkowa" }).click();
  await expect(sheet.getByTestId("journal-entry-stage")).toContainText("Kanalizacja podposadzkowa");
  await expect(chips).toHaveCount(0);
  await page.locator("[data-sonner-toast]").filter({ hasText: "Etap zrobiony: Kanalizacja podposadzkowa" }).getByRole("button", { name: "Cofnij" }).click();
  await expect(chips.first()).toHaveText("Kanalizacja podposadzkowa");
  await expect(sheet.getByTestId("journal-entry-stage")).toHaveCount(0);

  await sheet.getByRole("button", { name: "Odhacz etap: Rozprowadzenie wody" }).click();
  await page.keyboard.press("Escape");
  await page.getByTestId("study-journal").getByRole("button", { name: "Lipowa 5: karta budowy" }).click();
  const stages = page.getByTestId("site-card").getByTestId("site-stages");
  await expect(stages.getByTestId("site-stages-progress")).toHaveText("1/7");
  await expect(stages.getByRole("checkbox", { name: /Rozprowadzenie wody/ })).toHaveAttribute("aria-checked", "true");
});
