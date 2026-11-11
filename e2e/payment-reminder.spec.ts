import { test, expect } from "@playwright/test";
import { inCard, inPapiery, openSection } from "./helpers";

// Faza 4 (B4.1, B4.2): konto i cennik w Ustawieniach, przypomnienie o należności w rozliczeniu budowy.

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

test("przypomnienie o należności: przyciski dopiero z telefonem inwestora i kwotą do zapłaty", async ({ page }) => {
  await page.goto("/praca");
  await page.getByTestId("study-journal").getByRole("button", { name: "Lipowa 5: karta budowy" }).click();
  const card = page.getByTestId("site-card");

  await openSection(card, "Pieniądze");
  const panel = await inCard(card, "site-billing");
  await panel.getByRole("button", { name: /^Rozliczenie/ }).click();
  await panel.getByRole("button", { name: "Ryczałt", exact: true }).click();
  const lump = panel.getByLabel("Za całą budowę (zł)", { exact: true });
  await lump.fill("2000");
  await lump.press("Enter");
  await expect(panel.getByTestId("billing-due")).toContainText("2");
  // Bez telefonu inwestora nie ma przypomnienia.
  await expect(panel.getByTestId("billing-remind")).toHaveCount(0);

  await (await inPapiery(card)).getByRole("button", { name: /^Edytuj dane/ }).click();
  await card.getByPlaceholder("600 100 200").first().fill("600 100 200");
  await card.getByRole("button", { name: "Zapisz kartę" }).click();

  await openSection(card, "Pieniądze");
  const remind = card.getByTestId("billing-remind");
  await expect(remind).toBeVisible();
  await expect(remind.getByRole("button", { name: "Przypomnij SMS-em" })).toBeEnabled();
  await expect(remind.getByRole("button", { name: "Przypomnij na WhatsAppie" })).toBeEnabled();
});

test("Ustawienia: numer konta i cennik zostają po odświeżeniu", async ({ page }) => {
  await page.goto("/?settings=ogolne");
  await page.locator("#bank-account").fill("12 3456 7890");
  await page.locator("#bank-account").blur();
  await page.getByPlaceholder("Np. WC podwieszane").fill("WC podwieszane");
  await page.getByPlaceholder("Cena (zł)").fill("350");
  await page.getByRole("button", { name: "Dodaj pozycję" }).click();
  await expect(page.getByText("350 zł · H-4")).toBeVisible();
  await page.goto("/?settings=ogolne");
  await expect(page.getByText("WC podwieszane", { exact: true })).toBeVisible();
  await expect(page.locator("#bank-account")).toHaveValue("12 3456 7890");
});
