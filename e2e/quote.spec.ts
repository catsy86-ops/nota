import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";

// Plan wycen i klientów, Etapy 3–5: wycena jako dokument (numer, rabat, VAT, uwagi, zaliczka, stan), PDF, szablon,
// duplikat, przegląd wycen na liście Zlecenia.

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

async function newJob(page: Page) {
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Dziennik" }).click();
  const list = page.getByTestId("jobs-dialog");
  await expect(async () => {
    await page.getByTestId("jobs-open").click();
    await expect(list).toBeVisible({ timeout: 1000 });
  }).toPass();
  await list.getByRole("button", { name: "Nowe zlecenie" }).click();
  await page.getByLabel("Nazwa zlecenia").fill("Kowalski kran");
  await page.getByLabel("Klient", { exact: true }).fill("Jan Kowalski");
  await page.getByRole("button", { name: "Utwórz zlecenie" }).click();
  const card = page.getByTestId("site-card");
  await expect(card.getByTestId("site-job")).toBeVisible();
  return card;
}

async function addItem(card: ReturnType<Page["getByTestId"]>, name: string, price: string) {
  const form = card.getByRole("form", { name: "Nowa pozycja wyceny" });
  await form.getByLabel("Nazwa pozycji").fill(name);
  await form.getByLabel("Cena za jednostkę (zł)").fill(price);
  await form.getByRole("button", { name: "Dodaj" }).click();
}

test("wycena jako dokument: numer, rabat, VAT, uwagi, zaliczka, PDF i stan @mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const card = await newJob(page);
  const job = card.getByTestId("site-job");
  await addItem(card, "Montaż instalacji", "1000");

  // Numer i data wystawienia (zegar na 2 listopada 2026).
  const doc = job.getByTestId("quote-doc");
  await expect(doc.getByTestId("quote-state")).toHaveText("Szkic");
  await doc.getByTestId("quote-give-number").click();
  await expect(doc.getByTestId("quote-number")).toHaveText("W/A/2026/001 · 02.11.2026");

  await doc.getByLabel("Rabat na całość (%)").fill("10");
  await doc.getByLabel("Rabat na całość (%)").press("Enter");
  await doc.getByRole("group", { name: "VAT na wycenie" }).getByRole("button", { name: "Netto + VAT" }).click();
  await expect(job.getByTestId("job-discount")).toContainText("Rabat 10%");
  await expect(job.getByTestId("job-total")).toHaveText(/^1\D?107 zł$/);
  await doc.getByLabel("Uwagi i warunki").fill("Termin: 5 dni roboczych.");
  await doc.getByLabel("Uwagi i warunki").blur();

  // Zaliczka: kwota, wpłata i „Do zapłaty”.
  await doc.getByLabel("Zaliczka (zł)").fill("300");
  await doc.getByLabel("Zaliczka (zł)").press("Enter");
  await doc.getByTestId("deposit-receive").click();
  await expect(doc.getByTestId("deposit-paid")).toContainText("300 zł");
  await expect(job.getByTestId("job-paid")).toHaveText(/300 zł/);
  await expect(job.getByTestId("job-due")).toHaveText(/^807 zł$/);

  const wide = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(wide, "przewijanie w bok przy 390 px").toBe(false);

  // PDF ustawia stan „Wysłana”.
  const download = page.waitForEvent("download", { timeout: 30000 });
  await job.getByRole("button", { name: "PDF wyceny" }).click();
  expect((await download).suggestedFilename()).toBe("Wycena - Kowalski kran.pdf");
  await expect(doc.getByTestId("quote-state")).toContainText("Wysłana");

  await doc.getByTestId("quote-accept").click();
  await expect(doc.getByTestId("quote-state")).toContainText("Przyjęta");
  await expect(job.getByTestId("site-job-summary")).toContainText("Wycena");
});

test("wycena: szablon, duplikat i przegląd na liście Zlecenia", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const card = await newJob(page);
  const job = card.getByTestId("site-job");
  await addItem(card, "Montaż baterii", "150");

  // Szablon: zapis, wstawienie do tej samej wyceny (druga pozycja), „Cofnij” nie jest sprawdzane tutaj.
  await job.getByTestId("template-save-open").click();
  await job.getByLabel("Nazwa szablonu").fill("Kran — wymiana");
  await job.getByTestId("template-save").click();
  await job.getByLabel("Szablon wyceny").selectOption({ label: "Kran — wymiana · 1 poz." });
  await job.getByTestId("template-insert").click();
  await expect(job.getByTestId("job-item")).toHaveCount(2);
  await expect(job.getByTestId("job-total")).toHaveText("300 zł");

  // Duplikat zakłada nowe zlecenie „… (kopia)”.
  await job.getByTestId("job-duplicate").click();
  await expect(page.getByText("Utworzono zlecenie „Kowalski kran (kopia)”")).toBeVisible();

  // Wysłanie PDF-u i przegląd: filtr stanu i podsumowanie miesiąca.
  const download = page.waitForEvent("download", { timeout: 30000 });
  await job.getByRole("button", { name: "PDF wyceny" }).click();
  await download;
  await page.keyboard.press("Escape");
  await page.getByTestId("jobs-open").click();
  const dialog = page.getByTestId("jobs-dialog");
  await expect(dialog.getByTestId("jobs-review")).toContainText("wysłane 1");
  const filter = dialog.getByRole("group", { name: "Filtr stanu wyceny" });
  await filter.getByRole("button", { name: "Wysłana" }).click();
  await expect(dialog.getByRole("button", { name: /Kowalski kran(?! \(kopia\))/ })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /kopia/ })).toHaveCount(0);
  await filter.getByRole("button", { name: "Szkic" }).click();
  await expect(dialog.getByRole("button", { name: /kopia/ })).toBeVisible();
});

test("wycena: dostępność panelu dokumentu (axe)", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const card = await newJob(page);
  await addItem(card, "Montaż baterii", "150");
  const job = card.getByTestId("site-job");
  await job.getByTestId("quote-give-number").click();
  await job.getByRole("group", { name: "VAT na wycenie" }).getByRole("button", { name: "Brutto" }).click();
  await job.getByLabel("Zaliczka (zł)").fill("50");
  await job.getByLabel("Zaliczka (zł)").press("Enter");
  const axe = await new AxeBuilder({ page }).include("[data-testid='quote-doc']").withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
  expect(axe.violations).toEqual([]);
});
