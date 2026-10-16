import { test, expect, type Page } from "@playwright/test";

// Kontakt i dojazd w karcie budowy: telefony, kierownik, dostęp — szybkie akcje po zapisie i po przeładowaniu.

async function reloadWhenSaved(page: Page) {
  await expect(page.getByText("Zapisano", { exact: true })).toBeVisible();
  await page.reload();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.study.tab.v1", "journal");
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      site: "Lipowa 5",
      journal: [{ id: "a", at: Date.now() - 3600_000, kind: "ok", topic: null, text: "Piony", site: "Lipowa 5", checked: [], images: [] }],
    }));
  });
});

test("kontakt i dojazd: Nawiguj, Zadzwoń, SMS, kierownik i dostęp z karty budowy", async ({ page }) => {
  await page.goto("/praca");
  const journal = page.getByTestId("study-journal");
  await journal.getByRole("button", { name: "Lipowa 5: karta budowy" }).click();
  const card = page.getByTestId("site-card");
  // Bez adresu i telefonów nie ma paska szybkich akcji.
  await expect(card.getByTestId("site-quick")).toHaveCount(0);

  await card.getByLabel("Adres", { exact: true }).fill("ul. Lipowa 5, Kraków");
  await card.getByLabel("Inwestor", { exact: true }).fill("Nowak");
  await card.getByLabel("Telefon inwestora").fill("600 100 200");
  await card.getByLabel("Kierownik budowy").fill("Marek");
  await card.getByLabel("Telefon kierownika").fill("+48 700-800-900");
  await card.getByLabel("Dostęp do budowy").fill("Kod do bramy 1234#");
  await card.getByRole("button", { name: "Zapisz kartę" }).click();

  const quick = card.getByTestId("site-quick");
  await expect(quick.getByRole("link", { name: "Nawiguj" })).toHaveAttribute("href", /google\.com\/maps\/dir\/.*destination=ul\.%20Lipowa%205/);
  await expect(quick.getByRole("link", { name: "Zadzwoń do inwestora: +48 600 100 200" })).toHaveAttribute("href", "tel:+48600100200");
  await expect(quick.getByRole("link", { name: "SMS do inwestora: +48 600 100 200" })).toHaveAttribute("href", "sms:+48600100200");
  await expect(quick.getByRole("link", { name: "Zadzwoń do kierownika: +48 700 800 900" })).toHaveAttribute("href", "tel:+48700800900");
  await expect(card.getByTestId("site-access")).toContainText("Kod do bramy 1234#");

  await reloadWhenSaved(page);
  await page.getByTestId("study-journal").getByRole("button", { name: "Lipowa 5: karta budowy" }).click();
  await expect(page.getByTestId("site-card").getByLabel("Telefon kierownika")).toHaveValue("+48 700-800-900");
  await expect(page.getByTestId("site-access")).toContainText("Kod do bramy 1234#");
});
