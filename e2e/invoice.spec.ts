import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";

// KSeF Etap 1 (ADR-6): wystawianie faktury z wyceny zlecenia własnego, pobranie XML FA(3), niezmienność i numeracja.

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

async function jobWithItem(page: Page) {
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await expect(async () => {
    await page.getByTestId("jobs-open").click();
    await expect(page.getByTestId("jobs-dialog")).toBeVisible({ timeout: 1000 });
  }).toPass();
  await page.getByTestId("jobs-dialog").getByRole("button", { name: "Nowe zlecenie" }).click();
  await page.getByLabel("Nazwa zlecenia").fill("Kowalski kran");
  await page.getByLabel("Klient", { exact: true }).fill("Jan Kowalski");
  await page.getByLabel("Adres", { exact: true }).fill("Polna 3, Kraków");
  await page.getByLabel("Co zrobić").fill("Wymiana baterii");
  await page.getByRole("button", { name: "Utwórz zlecenie" }).click();
  const card = page.getByTestId("site-card");
  const form = card.getByRole("form", { name: "Nowa pozycja wyceny" });
  await form.getByRole("button", { name: "Robocizna" }).click();
  await form.getByLabel("Nazwa pozycji").fill("Wymiana baterii");
  await form.getByLabel("Cena za jednostkę (zł)").fill("123");
  await form.getByRole("button", { name: "Dodaj" }).click();
  await card.getByTestId("site-job").getByRole("group", { name: "Status zlecenia" }).getByRole("button", { name: "Zrobione" }).click();
  return card;
}

test("faktura z wyceny: dane sprzedawcy, numer z serii, XML do pobrania, druga faktura ma kolejny numer", async ({ page }) => {
  const card = await jobWithItem(page);
  await card.getByTestId("job-invoice").click();
  const dialog = page.getByTestId("invoice-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("invoice-line")).toHaveCount(1);
  await expect(dialog.getByTestId("invoice-gross")).toContainText("123");

  // Bez danych sprzedawcy faktura nie powstaje i mówi, czego brakuje.
  await dialog.getByTestId("invoice-issue").click();
  await expect(dialog.getByTestId("invoice-problems")).toContainText("NIP sprzedawcy");
  const axe = await new AxeBuilder({ page }).include("[data-testid='invoice-dialog']").withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
  await expect(dialog.getByTestId("invoice-item")).toHaveCount(0);

  await dialog.getByLabel("Nazwa sprzedawcy").fill("Jan Kowalski Hydraulik");
  await dialog.getByLabel("NIP sprzedawcy").fill("526-025-02-74");
  await dialog.getByLabel("Adres sprzedawcy").fill("ul. Lipowa 5");
  await dialog.getByLabel("Kod i miejscowość sprzedawcy").fill("30-001 Kraków");
  await dialog.getByTestId("invoice-issue").click();

  await expect(dialog.getByTestId("invoice-item")).toHaveCount(1);
  await expect(dialog.getByTestId("invoice-item").first()).toContainText("FV/A/2026/001");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    dialog.getByRole("button", { name: "Pobierz XML faktury FV/A/2026/001" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("FV-A-2026-001.xml");
  const xml = readFileSync((await download.path())!, "utf8");
  expect(xml).toContain('<Faktura xmlns="http://crd.gov.pl/wzor/2025/06/25/13775/">');
  expect(xml).toContain("<P_2>FV/A/2026/001</P_2>");
  expect(xml).toContain("<NIP>5260250274</NIP>");
  expect(xml).toContain("<P_15>123.00</P_15>");
  expect(xml).toContain("<BrakID>1</BrakID>");

  await dialog.getByRole("button", { name: "Sprawdź" }).click();
  await expect(dialog.getByTestId("invoice-item").first()).toContainText("skrót zgodny");

  await dialog.getByTestId("invoice-issue").click();
  await expect(dialog.getByTestId("invoice-item")).toHaveCount(2);
  await expect(dialog.getByTestId("invoice-list")).toContainText("FV/A/2026/002");

  // Po odświeżeniu faktury zostają (Yjs), a dane sprzedawcy są zapamiętane.
  await page.waitForTimeout(1500);
  await page.reload();
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await page.getByTestId("jobs-open").click();
  await page.getByTestId("jobs-dialog").getByRole("button", { name: /Kowalski kran/ }).click();
  await page.getByTestId("site-card").getByTestId("job-invoice").click();
  const again = page.getByTestId("invoice-dialog");
  await expect(again.getByTestId("invoice-item")).toHaveCount(2);
  await expect(again.getByLabel("NIP sprzedawcy")).toHaveValue("5260250274");
});

test("przycisk faktury jest tylko przy zleceniu zrobionym albo zapłaconym", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await expect(async () => {
    await page.getByTestId("jobs-open").click();
    await expect(page.getByTestId("jobs-dialog")).toBeVisible({ timeout: 1000 });
  }).toPass();
  await page.getByTestId("jobs-dialog").getByRole("button", { name: "Nowe zlecenie" }).click();
  await page.getByLabel("Nazwa zlecenia").fill("Nowak wc");
  await page.getByLabel("Klient", { exact: true }).fill("Anna Nowak");
  await page.getByLabel("Adres", { exact: true }).fill("Polna 2");
  await page.getByLabel("Co zrobić").fill("WC");
  await page.getByRole("button", { name: "Utwórz zlecenie" }).click();
  const card = page.getByTestId("site-card");
  await expect(card.getByTestId("job-invoice")).toHaveCount(0);
});
