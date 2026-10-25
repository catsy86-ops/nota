import { test, expect, type Page } from "@playwright/test";

// Godziny na budowach (H2): dzień na dwóch budowach — podział w oknie, godziny przy budowie i w raporcie jednej budowy.

async function reloadWhenSaved(page: Page) {
  await expect(page.getByText("Zapisano", { exact: true })).toBeVisible();
  await page.reload();
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 14, 18, 0).getTime());
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.study.tab.v1", "journal");
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    // Dniówka „b” z domyślnych rodzajów: 07:00–17:00, 10 h.
    localStorage.setItem("kaczy:shifts", JSON.stringify({ version: 2, days: { "2026-10-14": { type: "b" } } }));
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      site: "Lipowa 5",
      journal: [
        { id: "a", at: new Date(2026, 9, 14, 8).getTime(), kind: "ok", topic: null, text: "Piony", site: "Lipowa 5", checked: [], images: [] },
        { id: "b", at: new Date(2026, 9, 14, 14).getTime(), kind: "ok", topic: null, text: "Podejścia", site: "Polna 2", checked: [], images: [] },
      ],
    }));
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test("godziny na budowach: podział dnia, reszta dla drugiej budowy, raport budowy z jej godzinami", async ({ page }) => {
  await page.goto("/praca");
  const journal = page.getByTestId("study-journal");
  const day = journal.locator('[data-journal-day="2026-10-14"]');
  await day.getByRole("button", { name: /podziel godziny między budowy/ }).click();

  const dialog = page.getByTestId("day-hours");
  await expect(dialog).toContainText("10 h");
  await dialog.getByLabel("Godziny: Lipowa 5").fill("6,5");
  await expect(dialog.getByTestId("day-hours-left")).toHaveText("Puste pole dostanie resztę: 3 h 30 min");
  await expect(dialog.getByLabel("Godziny: Polna 2")).toHaveAttribute("placeholder", "3,5");
  await dialog.getByRole("button", { name: "Zapisz" }).click();

  await expect(day.getByRole("button", { name: /godziny na budowach/ })).toHaveText("3,5 + 6,5 h");
  await expect(day.locator("[data-site-hours]")).toHaveText(["3,5 h", "6,5 h"]);

  await reloadWhenSaved(page);
  await page.getByTestId("study-journal").getByRole("button", { name: "Polna 2: karta budowy" }).click();
  // Suma godzin na karcie (1.4 planu Praca 2026-10-24).
  await expect(page.getByTestId("site-card-hours")).toHaveText("3,5 h łącznie · 3,5 h w tym miesiącu");
  await page.getByTestId("site-card").getByRole("button", { name: "Raport", exact: true }).click();
  await expect(page.getByText("3 h 30 min na tej budowie (z 10 h, Budowa 07:00–17:00)")).toBeVisible();
});

test("błędna liczba godzin nie zapisuje", async ({ page }) => {
  await page.goto("/praca");
  await page.locator('[data-journal-day="2026-10-14"]').getByRole("button", { name: /podziel godziny/ }).click();
  const dialog = page.getByTestId("day-hours");
  await dialog.getByLabel("Godziny: Lipowa 5").fill("dużo");
  await expect(dialog.getByRole("alert")).toHaveText("Wpisz godziny jak 6, 6,5 albo 6:30.");
  await expect(dialog.getByRole("button", { name: "Zapisz" })).toBeDisabled();
});

test("karta budowy: dzień z dwiema budowami bez podziału jest „do podziału”", async ({ page }) => {
  await page.goto("/praca");
  await page.getByTestId("study-journal").getByRole("button", { name: "Lipowa 5: karta budowy" }).click();
  await expect(page.getByTestId("site-card-hours")).toHaveText("0 h łącznie · 0 h w tym miesiącu · 1 dzień do podziału");
});

test("karta budowy: „Wpisz godziny” na dzień bez wpisu, karta zostaje otwarta (1.5)", async ({ page }) => {
  await page.goto("/praca");
  await page.getByTestId("study-journal").getByRole("button", { name: "Polna 2: karta budowy" }).click();
  const card = page.getByTestId("site-card");
  await card.getByRole("button", { name: "Wpisz godziny" }).click();
  const dialog = page.getByTestId("day-hours");
  await expect(dialog.getByLabel("Dzień")).toHaveValue("2026-10-14");
  await dialog.getByLabel("Dzień").fill("2026-10-13");
  await expect(dialog.getByLabel("Godziny: Polna 2")).toBeVisible();
  await expect(dialog).toContainText("bez wpisu");
  await dialog.getByLabel("Godziny: Polna 2").fill("4");
  await dialog.getByRole("button", { name: "Zapisz" }).click();
  await expect(dialog).toBeHidden();
  await expect(card).toBeVisible();
  await expect(page.getByTestId("site-card-hours")).toHaveText("4 h łącznie · 4 h w tym miesiącu · 1 dzień do podziału");
});
