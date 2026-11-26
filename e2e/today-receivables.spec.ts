import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";

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
  await page.getByLabel("Klient", { exact: true }).fill("Jan Kowalski");
  await page.getByLabel("Adres", { exact: true }).fill("Polna 3, Kraków");
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

// R3.1 (PR-2): „Należności” na Dziś — zlecenie „zrobione” bez wpłaty, kwota, wiersz otwiera kartę budowy.
test("Należności na Dziś: zrobione zlecenie czeka na zapłatę, wiersz otwiera kartę budowy, „Zapłacone” je zdejmuje @mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // Zegar stoi (`setFixedTime`), więc przenikanie działu zamiera w połowie, a axe liczył kontrast półprzezroczystego
  // tekstu (`color-contrast` raz tak, raz nie). Bez ruchu sekcja na Dziś jest od razu w pełni widoczna.
  await page.emulateMedia({ reducedMotion: "reduce" });
  const card = await newJob(page);
  const job = card.getByTestId("site-job");
  await addItem(card, "Robocizna", "Wymiana baterii", "150");
  await job.getByRole("group", { name: "Status zlecenia" }).getByRole("button", { name: "Zrobione" }).click();
  await page.keyboard.press("Escape");
  await expect(card).toBeHidden();
  // Zamknięcie karty cofa adres `?budowa=` — `goto` w tej samej chwili przerywał nawigację (ERR_ABORTED).
  await expect(page).not.toHaveURL(/budowa=/);

  await page.goto("/dzis");
  const section = page.getByTestId("today-receivables");
  await expect(section).toBeVisible();
  await expect(section.getByTestId("today-receivables-total")).toHaveText("150 zł");
  const row = section.getByRole("button", { name: /^Kowalski kran: 150 zł, Zlecenie · od dziś — karta budowy$/ });
  await expect(row).toBeVisible();
  const axe = await new AxeBuilder({ page }).include('[data-testid="today-receivables"]').withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);

  await row.click();
  await expect(page).toHaveURL(/\/praca\?budowa=/);
  const opened = page.getByTestId("site-card");
  await expect(opened).toBeVisible();
  await opened.getByTestId("site-job").getByRole("group", { name: "Status zlecenia" }).getByRole("button", { name: "Zapłacone" }).click();
  await page.keyboard.press("Escape");
  await expect(opened).toBeHidden();
  await expect(page).not.toHaveURL(/budowa=/);
  await page.goto("/dzis");
  await expect(page.getByRole("heading", { name: "Dziś" }).first()).toBeVisible();
  await expect(page.getByTestId("today-receivables")).toHaveCount(0);
});
