import { test, expect, type Page } from "@playwright/test";

// Lista przed wejściem na budowę: punkt z karty (otwarty problem), odhaczanie, „Wchodzę” z godziną,
// własny punkt i stan po przeładowaniu.

async function reloadWhenSaved(page: Page) {
  await expect(page.getByText("Zapisano", { exact: true })).toBeVisible();
  await page.reload();
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 22, 7, 12).getTime());
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.study.tab.v1", "journal");
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      site: "Lipowa 5",
      journal: [{ id: "a", at: new Date(2026, 9, 21, 9).getTime(), kind: "problem", topic: null, text: "Brak spadku na pionie", site: "Lipowa 5", checked: [], images: [] }],
    }));
  });
});

test("lista przed wejściem: punkt z karty, odhaczanie, wejście z godziną, własny punkt, po przeładowaniu", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Dziennik" }).click();
  const card = page.getByTestId("entry-check");
  await expect(card).toContainText("Lipowa 5");
  // 8 punktów domyślnych + otwarty problem z tej budowy.
  await expect(card.getByTestId("entry-check-progress")).toHaveText("0/9");

  await card.getByRole("button", { name: "Sprawdź listę" }).click();
  const dialog = page.getByTestId("entry-check-dialog");
  await expect(dialog.getByRole("region", { name: "Na tej budowie" })).toContainText("Otwarty problem: Brak spadku na pionie");
  await dialog.getByRole("checkbox", { name: "Kask, buty z noskiem, kamizelka" }).click();
  await dialog.getByRole("checkbox", { name: /Otwarty problem/ }).click();
  await expect(dialog.getByRole("checkbox", { name: "Kask, buty z noskiem, kamizelka" })).toHaveAttribute("aria-checked", "true");
  await expect(dialog.getByTestId("entry-check-enter")).toHaveText("Wchodzę bez 7 punktów");

  // Własny punkt — wspólny dla wszystkich budów.
  await dialog.getByRole("button", { name: "Zmień listę" }).click();
  await dialog.getByLabel("Nowy punkt").fill("Klucz do skrzynki");
  await dialog.getByRole("button", { name: "Dodaj" }).click();
  await dialog.getByRole("button", { name: "Zapisz listę" }).click();
  await expect(dialog.getByRole("checkbox", { name: "Klucz do skrzynki" })).toBeVisible();
  await expect(dialog.getByTestId("entry-check-enter")).toHaveText("Wchodzę bez 8 punktów");

  await dialog.getByTestId("entry-check-enter").click();
  await expect(dialog).toBeHidden();
  await expect(card.getByTestId("entry-check-stamp")).toHaveText("Wejście 07:12");
  await expect(card.getByTestId("entry-check-progress")).toHaveText("2/10");

  await reloadWhenSaved(page);
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await expect(page.getByTestId("entry-check-stamp")).toHaveText("Wejście 07:12");
  await page.getByTestId("entry-check").getByRole("button", { name: "Pokaż listę" }).click();
  const again = page.getByTestId("entry-check-dialog");
  await expect(again.getByRole("checkbox", { name: "Klucz do skrzynki" })).toHaveAttribute("aria-checked", "false");
  await again.getByRole("button", { name: "Cofnij wejście" }).click();
  await expect(again.getByTestId("entry-check-enter")).toBeVisible();
});

// 1.2 planu Praca 2026-10-24: szybkie akcje z karty budowy i wybór budowy po zmianie widoku.
test("przed wejściem: Nawiguj, Zadzwoń, „Wpis tutaj” i wybrana budowa po powrocie", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Dziennik" }).click();
  const journal = page.getByTestId("study-journal");
  const card = page.getByTestId("entry-check");
  const actions = card.getByTestId("entry-check-actions");
  // Bez adresu i numeru zostaje sam wpis.
  await expect(actions.getByRole("link")).toHaveCount(0);
  await expect(actions.getByRole("button", { name: "Wpis tutaj" })).toBeVisible();

  await journal.getByRole("button", { name: "Lipowa 5: karta budowy" }).click();
  const site = page.getByTestId("site-card");
  await site.getByRole("button", { name: /^Edytuj dane/ }).click();
  await site.getByLabel("Adres", { exact: true }).fill("ul. Lipowa 5, Kraków");
  await site.getByLabel("Telefon kierownika").fill("700 800 900");
  await site.getByRole("button", { name: "Zapisz kartę" }).click();
  await page.keyboard.press("Escape");
  await expect(site).toBeHidden();

  await expect(actions.getByRole("link", { name: "Nawiguj" })).toHaveAttribute("href", /destination=ul\.%20Lipowa%205/);
  await expect(actions.getByRole("link", { name: "Zadzwoń do kierownika: +48 700 800 900" })).toHaveAttribute("href", "tel:+48700800900");

  // Druga budowa: wybór w karcie przeżywa wyjście z działu i powrót.
  await journal.getByRole("button", { name: /Nowa budowa/ }).first().click();
  await page.getByLabel("Nazwa budowy").fill("Polna 2");
  await page.getByRole("button", { name: "Utwórz budowę" }).click();
  await page.keyboard.press("Escape");
  await card.getByRole("group", { name: "Wybór budowy na dziś" }).getByRole("button", { name: "Polna 2" }).click();
  await expect(actions.getByRole("link")).toHaveCount(0);
  await reloadWhenSaved(page);
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await expect(page.getByTestId("entry-check").getByRole("button", { name: "Polna 2" })).toHaveAttribute("aria-pressed", "true");

  await page.getByTestId("entry-check-actions").getByRole("button", { name: "Wpis tutaj" }).click();
  await expect(page.getByTestId("journal-entry-sheet").getByRole("button", { name: "Budowa: Polna 2. Zmień" })).toBeVisible();
});

// 1.6 planu Praca 2026-10-24: „Wychodzę” — wyjście na pieczątce i podpowiedź godzin budowy.
test("„Wychodzę”: pieczątka 07:12–15:30, „Cofnij wyjście”, godziny z wejścia i wyjścia w oknie godzin", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Dziennik" }).click();
  const card = page.getByTestId("entry-check");
  await expect(card.getByTestId("entry-check-leave")).toHaveCount(0);
  await card.getByRole("button", { name: "Sprawdź listę" }).click();
  await page.getByTestId("entry-check-enter").click();
  await expect(card.getByTestId("entry-check-stamp")).toHaveText("Wejście 07:12");

  await page.clock.setFixedTime(new Date(2026, 9, 22, 15, 30).getTime());
  await card.getByTestId("entry-check-leave").click();
  await expect(card.getByTestId("entry-check-stamp")).toHaveText("07:12–15:30");
  await expect(page.getByText("Wyjście 15:30 — 8,33 h na budowie")).toBeVisible();
  await expect(card.getByTestId("entry-check-leave")).toHaveCount(0);

  await card.getByRole("button", { name: "Pokaż listę" }).click();
  const dialog = page.getByTestId("entry-check-dialog");
  await expect(dialog).toContainText("Wejście 07:12, wyjście 15:30");
  await dialog.getByRole("button", { name: "Cofnij wyjście" }).click();
  await expect(card.getByTestId("entry-check-stamp")).toHaveText("Wejście 07:12");
  await page.keyboard.press("Escape");
  await card.getByTestId("entry-check-leave").click();

  await page.getByTestId("study-journal").getByRole("button", { name: "Lipowa 5: karta budowy" }).click();
  await page.getByTestId("site-card").getByRole("button", { name: "Wpisz godziny" }).click();
  const hours = page.getByTestId("day-hours");
  await expect(hours.getByLabel("Godziny: Lipowa 5")).toHaveValue("8,33");
  await expect(hours.getByTestId("day-hours-presence")).toBeVisible();
});
