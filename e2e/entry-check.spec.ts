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
