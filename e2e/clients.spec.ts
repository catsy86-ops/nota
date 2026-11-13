import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";

// Plan wycen i klientów, Etapy 1–2: kartoteka klientów w Pracy, walidacja NIP, wyszukiwanie, „Nowa wycena” z karty klienta,
// nabywca na fakturze z danych klienta, klient w palecie poleceń.

const NIP = "5260250274";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 10, 2, 12, 0).getTime());
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      journal: [{ id: "a", at: new Date(2026, 10, 1, 9).getTime(), kind: "ok", topic: null, text: "Start", site: "Lipowa 5", checked: [], images: [] }],
    }));
  });
});

async function openClients(page: Page) {
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Klienci" }).click();
  await expect(page.getByTestId("clients-view")).toBeVisible();
}

async function addClient(page: Page, name: string, phone = "") {
  await page.getByTestId("client-new").click();
  await page.getByTestId("new-client-name").fill(name);
  if (phone) await page.getByLabel("Telefon (opcjonalnie)").fill(phone);
  await page.getByTestId("new-client-save").click();
  await expect(page.getByTestId("client-card")).toBeVisible();
}

test("klienci: dodanie, skróty kontaktu, walidacja NIP i wyszukiwanie @mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openClients(page);
  await expect(page.getByTestId("clients-empty")).toBeVisible();

  await addClient(page, "Jan Kowalski", "600 100 200");
  const card = page.getByTestId("client-card");
  await expect(card.getByRole("link", { name: "Zadzwoń" })).toHaveAttribute("href", "tel:+48600100200");

  // Zły NIP: komunikat i nic się nie zapisuje; poprawny schodzi bez błędu.
  const nip = card.getByLabel("NIP (puste = klient prywatny)");
  await nip.fill("123");
  await nip.blur();
  await expect(card.getByRole("alert")).toContainText("Nieprawidłowy NIP");
  await nip.fill("526-025-02-74");
  await nip.blur();
  await expect(card.getByRole("alert")).toHaveCount(0);

  const wide = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(wide, "przewijanie w bok przy 390 px").toBe(false);

  await page.keyboard.press("Escape");
  await addClient(page, "Anna Nowak");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("client-row")).toHaveCount(2);

  const search = page.getByTestId("clients-search");
  await search.fill("600100");
  await expect(page.getByTestId("client-row")).toHaveCount(1);
  await expect(page.getByTestId("client-row")).toContainText("Jan Kowalski");
  await search.fill(NIP.slice(0, 5));
  await expect(page.getByTestId("client-row")).toContainText("Jan Kowalski");
  await search.fill("nikt taki");
  await expect(page.getByTestId("clients-none")).toBeVisible();

  // Po odświeżeniu klienci zostają (Yjs); zapis do IndexedDB dobiega w tle.
  await page.waitForTimeout(1500);
  await page.reload();
  await page.getByRole("tab", { name: "Klienci" }).click();
  await expect(page.getByTestId("client-row")).toHaveCount(2);
});

test("klienci: dostępność listy i karty (axe)", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openClients(page);
  await addClient(page, "Jan Kowalski", "600 100 200");
  const axe = await new AxeBuilder({ page }).include("[data-testid='client-card']").withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
  expect(axe.violations).toEqual([]);
  await page.keyboard.press("Escape");
  const list = await new AxeBuilder({ page }).include("[data-testid='clients-view']").withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
  expect(list.violations).toEqual([]);
});

test("klient → „Nowa wycena” → wycena z rabatem i VAT → faktura z danymi klienta", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openClients(page);
  await addClient(page, "Jan Kowalski", "600 100 200");
  const clientCard = page.getByTestId("client-card");
  await clientCard.getByLabel("NIP (puste = klient prywatny)").fill(NIP);
  await clientCard.getByLabel("NIP (puste = klient prywatny)").blur();
  await clientCard.getByLabel("Adres", { exact: true }).fill("ul. Lipowa 5");
  await clientCard.getByLabel("Adres", { exact: true }).blur();
  await clientCard.getByTestId("client-new-quote").click();

  // Karta budowy zlecenia otwiera się sama, z klientem i panelem „Zlecenie własne”.
  const card = page.getByTestId("site-card");
  const job = card.getByTestId("site-job");
  await expect(job).toBeVisible();
  const form = job.getByRole("form", { name: "Nowa pozycja wyceny" });
  await form.getByLabel("Nazwa pozycji").fill("Montaż instalacji");
  await form.getByLabel("Cena za jednostkę (zł)").fill("1000");
  await form.getByRole("button", { name: "Dodaj" }).click();
  await expect(job.getByTestId("job-total")).toHaveText(/^1\D?000 zł$/);

  await job.getByLabel("Rabat na całość (%)").fill("10");
  await job.getByLabel("Rabat na całość (%)").press("Enter");
  await job.getByRole("group", { name: "VAT na wycenie" }).getByRole("button", { name: "Netto + VAT" }).click();
  await expect(job.getByTestId("job-net")).toHaveText(/^900 zł$/);
  await expect(job.getByTestId("job-vat")).toHaveText(/^207 zł$/);
  await expect(job.getByTestId("job-total")).toHaveText(/^1\D?107 zł$/);

  await job.getByRole("group", { name: "Status zlecenia" }).getByRole("button", { name: "Zrobione" }).click();
  await job.getByTestId("job-invoice").click();
  const invoice = page.getByTestId("invoice-dialog");
  await expect(invoice.getByLabel("Nazwa nabywcy")).toHaveValue("Jan Kowalski");
  await expect(invoice.getByLabel("NIP nabywcy")).toHaveValue(NIP);
  await expect(invoice.getByLabel("Adres nabywcy")).toHaveValue("ul. Lipowa 5");
  // Tryb cen i rabat z wyceny: netto + VAT, rabat wliczony w ceny pozycji.
  await expect(invoice.getByTestId("invoice-discount")).toContainText("10%");
  await expect(invoice.getByRole("button", { name: "Ceny netto" })).toHaveAttribute("aria-pressed", "true");
  await expect(invoice.getByTestId("buyer-client")).toContainText("Z kartoteki: Jan Kowalski");
});

test("klient w palecie poleceń otwiera zakładkę Klienci z jego kartą", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openClients(page);
  await addClient(page, "Zenon Paletowy", "512 333 444");
  await page.keyboard.press("Escape");
  // Zapis do IndexedDB dobiega w tle; pełne przeładowanie tuż po dodaniu klienta gubiło go pod obciążeniem.
  await page.waitForTimeout(1500);
  await page.goto("/");
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder(/Szukaj|Wpisz/).first().fill("paletowy");
  await page.getByRole("option", { name: /Klient: Zenon Paletowy/ }).click();
  await expect(page).toHaveURL(/\/praca$/);
  await expect(page.getByTestId("client-card")).toBeVisible();
  await expect(page.getByTestId("client-card")).toContainText("Zenon Paletowy");
});
