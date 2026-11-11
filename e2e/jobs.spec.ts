import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";
import { inCard, inPapiery } from "./helpers";

// H3.4 Zlecenia własne (fuchy): założenie z listy „Zlecenia”, wycena z marżą, statusy, „Niezapłacone”,
// PDF wyceny, termin w Kalendarzu, „To nie jest fucha” z „Cofnij”.

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
  // WebKit: pierwsze stuknięcie w przewijany pasek pigułek bywa zjadane przez przewinięcie — ponów.
  await expect(async () => {
    await page.getByTestId("jobs-open").click();
    await expect(list).toBeVisible({ timeout: 1000 });
  }).toPass();
  await expect(list.getByText("Nie masz jeszcze zleceń własnych.", { exact: false })).toBeVisible();
  await list.getByRole("button", { name: "Nowe zlecenie" }).click();
  await page.getByLabel("Nazwa zlecenia").fill("Kowalski kran");
  await page.getByLabel("Klient").fill("Jan Kowalski");
  await page.getByLabel("Adres").fill("Polna 3, Kraków");
  await page.getByLabel("Co zrobić").fill("Wymiana baterii w kuchni");
  await page.getByRole("button", { name: "Utwórz zlecenie" }).click();
  const card = page.getByTestId("site-card");
  await expect(card.getByTestId("site-job")).toBeVisible();
  return card;
}

async function addItem(card: ReturnType<Page["getByTestId"]>, kind: "Robocizna" | "Materiał", name: string, price: string) {
  const form = card.getByRole("form", { name: "Nowa pozycja wyceny" });
  await form.getByRole("button", { name: kind }).click();
  await form.getByLabel("Nazwa pozycji").fill(name);
  await form.getByLabel("Cena za jednostkę (zł)").fill(price);
  await form.getByRole("button", { name: "Dodaj" }).click();
}

test("fucha: wycena z marżą, status „Zrobione” liczy się do niezapłaconych, „Zapłacone” zdejmuje @mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const card = await newJob(page);
  const job = card.getByTestId("site-job");
  await expect(job.getByLabel("Co zrobić")).toHaveValue("Wymiana baterii w kuchni");
  // Fucha rozlicza się wyceną — panelu „Rozliczenie” budowy szefa nie ma.
  await expect(card.getByRole("tab", { name: "Pieniądze", exact: true })).toHaveCount(0);

  await addItem(card, "Robocizna", "Wymiana baterii", "150");
  await addItem(card, "Materiał", "Bateria", "250");
  await job.getByLabel("Marża na materiał (%)").fill("20");
  await job.getByLabel("Marża na materiał (%)").press("Enter");
  await expect(job.getByTestId("job-item")).toHaveCount(2);
  await expect(job.getByTestId("job-total")).toHaveText("450 zł");

  const wide = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(wide, "przewijanie w bok przy 390 px").toBe(false);

  await job.getByRole("group", { name: "Status zlecenia" }).getByRole("button", { name: "Zrobione" }).click();
  await expect(job.getByTestId("site-job-summary")).toHaveText("Zrobione · 450 zł");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("jobs-open")).toContainText("Zlecenia (1)");
  await expect(page.getByTestId("jobs-open")).toContainText("450 zł");

  await page.getByTestId("jobs-open").click();
  await expect(page.getByTestId("jobs-unpaid")).toHaveText("Niezapłacone: 450 zł");
  await page.getByTestId("jobs-dialog").getByRole("button", { name: /Kowalski kran/ }).click();
  await card.getByTestId("site-job").getByRole("button", { name: "Zapłacone" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("jobs-open")).not.toContainText("zł");

  // Po odświeżeniu wszystko zostaje (Yjs).
  await page.reload();
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await page.getByTestId("jobs-open").click();
  await expect(page.getByTestId("jobs-dialog").getByRole("button", { name: /Kowalski kran.*Zapłacone.*450 zł/ })).toBeVisible();
});

test("fucha: PDF wyceny, termin w Kalendarzu, „To nie jest fucha” z „Cofnij”, axe", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const card = await newJob(page);
  const job = card.getByTestId("site-job");
  await addItem(card, "Robocizna", "Wymiana baterii", "150");

  const axe = await new AxeBuilder({ page }).include("[data-testid='site-job']").withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
  expect(axe.violations).toEqual([]);

  const download = page.waitForEvent("download", { timeout: 30000 });
  await job.getByRole("button", { name: "PDF wyceny" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("Wycena - Kowalski kran.pdf");
  const fs = await import("node:fs");
  expect(fs.readFileSync((await file.path())!).subarray(0, 5).toString("ascii")).toBe("%PDF-");

  // Termin przy wycenie przestawia status na „Umówione”.
  await job.getByLabel("Termin zlecenia").fill("2026-11-05T14:00");
  await expect(job.getByTestId("site-job-summary")).toHaveText("Umówione · 150 zł");

  await job.getByRole("button", { name: "To nie jest fucha" }).click();
  await expect(card.getByTestId("site-job")).toHaveCount(0);
  await expect((await inCard(card, "site-billing"))).toBeVisible();
  await page.getByRole("button", { name: "Cofnij" }).click();
  await expect(card.getByTestId("site-job")).toBeVisible();
  await expect(card.getByTestId("job-item")).toHaveCount(1);

  await page.keyboard.press("Escape");
  await page.goto("/kalendarz");
  // Komórka dnia mówi o zleceniu w opisie dla czytnika ekranu („…, Praca: 1 zlecenie, …”).
  await expect(page.locator('[aria-label*="5 listopada 2026"][aria-label*="Praca: 1 zlecenie"]').first()).toBeAttached();
});

test("karta budowy szefa: „To zlecenie własne (fucha)” zamienia ją w fuchę", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await page.getByTestId("study-journal").getByRole("button", { name: "Lipowa 5: karta budowy" }).first().click();
  const card = page.getByTestId("site-card");
  await expect(card.getByTestId("site-job")).toHaveCount(0);
  await (await inPapiery(card)).getByRole("button", { name: "To zlecenie własne (fucha)" }).click();
  await expect(card.getByTestId("site-job")).toBeVisible();
  await expect(card.getByTestId("site-job-summary")).toHaveText("Wycena");
});

test("H3.6: raport „Wszystkie budowy szefa” bez fuch, „Wszystkie moje zlecenia” bez wysyłki szefowi", async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded-h36")) return;
    sessionStorage.setItem("seeded-h36", "1");
    const at = new Date(2026, 10, 2, 9).getTime();
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      journal: [
        { id: "a", at, kind: "ok", topic: null, text: "Pion kanalizacji", site: "Lipowa 5", checked: [], images: [] },
        { id: "b", at: at + 3600_000, kind: "ok", topic: null, text: "Bateria wymieniona", site: "Kowalski kran", checked: [], images: [] },
      ],
    }));
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await page.getByTestId("study-journal").getByRole("button", { name: "Kowalski kran: karta budowy" }).first().click();
  await (await inPapiery(page)).getByRole("button", { name: "To zlecenie własne (fucha)" }).click();
  await expect(page.getByTestId("site-job")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByTestId("study-journal").getByRole("button", { name: "Raport" }).click();
  const dialog = page.getByTestId("journal-report");
  const pick = dialog.getByLabel("Budowa raportu");
  await pick.selectOption("all");
  await expect(dialog.getByText("Pion kanalizacji")).toBeVisible();
  await expect(dialog.getByText("Bateria wymieniona")).toHaveCount(0);
  await expect(dialog.getByTestId("own-report-note")).toHaveCount(0);

  await pick.selectOption("jobs");
  await expect(dialog.getByText("Bateria wymieniona")).toBeVisible();
  await expect(dialog.getByText("Pion kanalizacji")).toHaveCount(0);
  await expect(dialog.getByTestId("own-report-note")).toBeVisible();
  await expect(dialog.getByRole("button", { name: /Szefowi|dodaj szefa/ })).toHaveCount(0);
});

test("H3.5: po „Zrobione” podpis klienta i PDF „Potwierdzenie wykonania” z obrazem podpisu", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const card = await newJob(page);
  const job = card.getByTestId("site-job");
  await addItem(card, "Robocizna", "Wymiana baterii", "150");
  await expect(job.getByTestId("job-done")).toHaveCount(0);
  await job.getByRole("group", { name: "Status zlecenia" }).getByRole("button", { name: "Zrobione" }).click();

  await job.getByTestId("job-sign").click();
  const dialog = page.getByTestId("site-signature");
  await dialog.getByLabel("Imię i nazwisko podpisującego").fill("Jan Kowalski");
  await expect(dialog.getByTestId("signature-pad")).toBeVisible({ timeout: 15000 });
  const pad = (await dialog.getByTestId("signature-pad").boundingBox())!;
  await page.mouse.move(pad.x + 30, pad.y + 100);
  await page.mouse.down();
  for (const [dx, dy] of [[60, -40], [100, 10], [150, -30], [220, 5]]) await page.mouse.move(pad.x + dx, pad.y + 100 + dy, { steps: 4 });
  await page.mouse.up();
  await dialog.getByRole("button", { name: "Zapisz podpis" }).click();
  await expect(job.getByTestId("job-sign")).toHaveText("Podpisane");

  const download = page.waitForEvent("download", { timeout: 30000 });
  await job.getByRole("button", { name: "Potwierdzenie wykonania" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("Potwierdzenie wykonania - Kowalski kran.pdf");
  const fs = await import("node:fs");
  const bytes = fs.readFileSync((await file.path())!);
  expect(bytes.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  // Obraz podpisu w pliku (jsPDF zapisuje obrazy jako /Subtype /Image).
  expect(bytes.toString("latin1")).toContain("/Subtype /Image");

  // Zmiana wyceny po podpisie unieważnia go na potwierdzeniu (przegląd bezpieczeństwa M1).
  await page.clock.setFixedTime(new Date(2026, 10, 2, 12, 5).getTime());
  await addItem(card, "Materiał", "Bateria", "250");
  await expect(job.getByTestId("job-sign")).toHaveText("Podpisz ponownie");
});

test("wycena z cennika (B4.1): pozycja wypełnia formularz, ilość można zmienić; bez cennika jest podpowiedź", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const card = await newJob(page);
  const form = card.getByRole("form", { name: "Nowa pozycja wyceny" });
  // Pusty cennik: podpowiedź, gdzie go dodać.
  await expect(form.getByText(/dodasz w Ustawieniach/)).toBeVisible();

  await page.evaluate(() => localStorage.setItem("kaczy.study.pricing.v1", JSON.stringify({
    items: [
      { id: "p1", name: "WC podwieszane", price: 350, pointType: "H-4", createdAt: 1 },
      { id: "p2", name: "Wymiana baterii", price: 120.5, pointType: "H-4", createdAt: 2 },
    ],
  })));
  await page.reload();
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await page.getByTestId("jobs-open").click();
  await page.getByTestId("jobs-dialog").getByText("Kowalski kran").click();
  const job = page.getByTestId("site-card").getByTestId("site-job");
  const pricing = job.getByRole("group", { name: "Z cennika" });
  await expect(pricing.getByRole("button")).toHaveCount(2);

  await pricing.getByRole("button", { name: /WC podwieszane/ }).click();
  const f = job.getByRole("form", { name: "Nowa pozycja wyceny" });
  await expect(f.getByLabel("Nazwa pozycji")).toHaveValue("WC podwieszane");
  await expect(f.getByLabel("Cena za jednostkę (zł)")).toHaveValue("350");
  await f.getByLabel("Ilość").fill("2");
  await f.getByRole("button", { name: "Dodaj" }).click();
  await expect(job.getByTestId("job-item")).toHaveCount(1);
  await expect(job.getByTestId("job-total")).toHaveText("700 zł");

  // Materiał to nie robocizna: cennik się chowa.
  await f.getByRole("button", { name: "Materiał" }).click();
  await expect(job.getByRole("group", { name: "Z cennika" })).toHaveCount(0);
});

test("nowe zlecenie: klient i telefon z kontaktów telefonu (B3.8)", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "contacts", { configurable: true, value: { select: async () => [{ name: ["Jan Kowalski"], tel: ["600 100 200"] }] } });
  });
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await expect(async () => {
    await page.getByTestId("jobs-open").click();
    await expect(page.getByTestId("jobs-dialog")).toBeVisible({ timeout: 1000 });
  }).toPass();
  await page.getByTestId("jobs-dialog").getByRole("button", { name: "Nowe zlecenie" }).click();
  await page.getByRole("button", { name: "Wybierz klienta z kontaktów" }).click();
  await expect(page.getByLabel("Klient", { exact: true })).toHaveValue("Jan Kowalski");
  await expect(page.getByLabel("Telefon", { exact: true })).toHaveValue("600 100 200");
});
