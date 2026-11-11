import { test, expect, type Page } from "@playwright/test";
import { inCard, inPapiery } from "./helpers";

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

  // Dane karty zwinięte za „Edytuj dane” (1.3 planu Praca 2026-10-24).
  await (await inPapiery(card)).getByRole("button", { name: /^Edytuj dane/ }).click();
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
  await expect((await inCard(page, "site-data"))).toContainText("ul. Lipowa 5, Kraków · Nowak · kier. Marek");
  await (await inPapiery(page)).getByRole("button", { name: /^Edytuj dane/ }).click();
  await expect(page.getByTestId("site-card").getByLabel("Telefon kierownika")).toHaveValue("+48 700-800-900");
  await expect(page.getByTestId("site-access")).toContainText("Kod do bramy 1234#");
});

test("kontakty z telefonu (B3.8): przyciski wypełniają numer i puste pole imienia, nie nadpisują wpisanego", async ({ page }) => {
  await page.addInitScript(() => {
    const queue = [
      { name: ["Jan Kowalski"], tel: ["600 100 200"] },
      { name: ["Marek Nowak"], tel: ["+48 700 800 900"] },
      { tel: ["22 000 00 00"] },
    ];
    Object.defineProperty(navigator, "contacts", { configurable: true, value: { select: async () => [queue.shift()] } });
  });
  await page.goto("/praca");
  await page.getByTestId("study-journal").getByRole("button", { name: "Lipowa 5: karta budowy" }).click();
  const card = page.getByTestId("site-card");
  await (await inPapiery(card)).getByRole("button", { name: /^Edytuj dane/ }).click();

  // Inwestor: numer i (puste) imię.
  await card.getByRole("button", { name: "Wybierz inwestora z kontaktów" }).click();
  await expect(card.getByLabel("Telefon inwestora")).toHaveValue("600 100 200");
  await expect(card.getByLabel("Inwestor", { exact: true })).toHaveValue("Jan Kowalski");

  // Kierownik: wpisane imię zostaje, numer się podmienia.
  await card.getByLabel("Kierownik budowy").fill("Marek");
  await card.getByRole("button", { name: "Wybierz kierownika z kontaktów" }).click();
  await expect(card.getByLabel("Telefon kierownika")).toHaveValue("+48 700 800 900");
  await expect(card.getByLabel("Kierownik budowy")).toHaveValue("Marek");

  // Hurtownia: sam numer.
  await card.getByRole("button", { name: "Wybierz hurtownię z kontaktów" }).click();
  await expect(card.getByLabel(/^Telefon hurtowni/)).toHaveValue("22 000 00 00");

  await card.getByRole("button", { name: "Zapisz kartę" }).click();
  await expect(page.getByTestId("site-card").getByTestId("site-quick").getByRole("link", { name: /Zadzwoń do inwestora/ })).toHaveAttribute("href", "tel:+48600100200");
});

test("bez Contact Picker (komputer, iPhone) przycisków z kontaktów nie ma", async ({ page }) => {
  await page.goto("/praca");
  await page.getByTestId("study-journal").getByRole("button", { name: "Lipowa 5: karta budowy" }).click();
  const card = page.getByTestId("site-card");
  await (await inPapiery(card)).getByRole("button", { name: /^Edytuj dane/ }).click();
  await expect(card.getByTestId("pick-contact-investor")).toHaveCount(0);
});
