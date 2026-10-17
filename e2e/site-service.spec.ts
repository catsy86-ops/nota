import { test, expect, type Page } from "@playwright/test";

// Serwis i gwarancja (H4): zgłoszenie z terminem na dziś → przypomnienie nad Dziennikiem → zamknięcie z opisem; gwarancja.

async function reloadWhenSaved(page: Page) {
  await expect(page.getByText("Zapisano", { exact: true })).toBeVisible();
  await page.reload();
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 16, 10, 0).getTime());
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.study.tab.v1", "journal");
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      site: "Lipowa 5",
      journal: [{ id: "a", at: new Date(2026, 9, 10, 9).getTime(), kind: "ok", topic: null, text: "Odbiór", site: "Lipowa 5", checked: [], images: [] }],
    }));
  });
});

test("serwis: zgłoszenie na dziś, przypomnienie, zamknięcie z opisem, gwarancja — po przeładowaniu", async ({ page }) => {
  await page.goto("/praca");
  const journal = page.getByTestId("study-journal");
  await journal.getByRole("button", { name: "Lipowa 5: karta budowy" }).click();
  const service = page.getByTestId("site-service");

  await service.getByLabel("Koniec gwarancji").fill("2028-10-16");
  await expect(service.getByTestId("site-warranty")).toHaveText("zostało 731 dni");

  await service.getByLabel("Nowe zgłoszenie serwisowe").fill("Cieknie syfon w łazience");
  await service.getByLabel("Termin wizyty").fill("2026-10-16");
  await service.getByRole("button", { name: "Dodaj" }).click();
  await expect(service.getByTestId("site-service-open")).toHaveText("otwarte: 1");
  await expect(service).toContainText("wizyta dziś");

  await reloadWhenSaved(page);
  // Przypomnienie nad Dziennikiem prowadzi do karty budowy.
  const reminder = page.locator('[data-reminder="service-due"]');
  await expect(reminder).toContainText("Serwis „Lipowa 5” na dziś: Cieknie syfon w łazience");
  await reminder.getByRole("button", { name: "Karta budowy" }).click();
  const after = page.getByTestId("site-service");
  await expect(after.getByTestId("site-warranty")).toHaveText("zostało 731 dni");

  await after.getByRole("button", { name: "Załatwione" }).click();
  await after.getByLabel("Co zrobiono").fill("wymieniona uszczelka");
  await after.getByRole("button", { name: "Zamknij" }).click();
  await expect(after.getByTestId("site-service-open")).toHaveCount(0);
  await after.getByRole("button", { name: "Załatwione (1)" }).click();
  await expect(after.getByTestId("site-service-done")).toContainText("→ wymieniona uszczelka");
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-reminder="service-due"]')).toHaveCount(0);
});
