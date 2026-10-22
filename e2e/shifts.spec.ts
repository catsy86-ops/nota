import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Stały miesiąc bez świąt: w święto etykieta dnia zawiera jego nazwę
  // („1 listopada, Wszystkich Świętych, wolne”) i selektory nic by nie znalazły.
  await page.clock.setFixedTime(new Date("2026-10-07T10:00:00"));
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/grafik");
});

test("nanoszenie zmian liczy godziny, nocne i zarobek", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Grafik" })).toBeVisible();
  const summary = page.getByRole("region", { name: "Podsumowanie miesiąca" });
  await expect(summary).toContainText("0");

  // Pędzel „Dzień” jest domyślny — dwa dni po 8 h.
  await page.getByRole("button", { name: /^1 [a-ząćęłńóśźż]+, [a-ząćęłńóśźż]+, wolne$/ }).first().click();
  await page.getByRole("button", { name: /^2 [a-ząćęłńóśźż]+, [a-ząćęłńóśźż]+, wolne$/ }).first().click();
  // Noc na trzeci dzień.
  await page.getByRole("radio", { name: /Noc/ }).click();
  await page.getByRole("button", { name: /^3 [a-ząćęłńóśźż]+, [a-ząćęłńóśźż]+, wolne$/ }).first().click();

  await expect(summary.getByText("24", { exact: false }).first()).toBeVisible();
  await expect(summary).toContainText("Dni pracy3");
  await expect(summary).toContainText("W nocy8 h");

  const settings = await openSettings(page);
  await settings.getByLabel("Stawka za godzinę").fill("30");
  await page.keyboard.press("Escape");
  await expect(summary).toContainText("720,00");

  // Grafik przeżywa odświeżenie.
  await page.reload();
  await expect(page.getByRole("region", { name: "Podsumowanie miesiąca" })).toContainText("Dni pracy3");
});

test("ponowne stuknięcie tą samą zmianą czyści dzień", async ({ page }) => {
  const day = page.getByRole("button", { name: /^5 [a-ząćęłńóśźż]+, [a-ząćęłńóśźż]+, wolne$/ }).first();
  await day.click();
  await expect(page.getByRole("button", { name: /^5 [a-ząćęłńóśźż]+, [a-ząćęłńóśźż]+, Dzień/ }).first()).toBeVisible();
  await page.getByRole("button", { name: /^5 [a-ząćęłńóśźż]+, [a-ząćęłńóśźż]+, Dzień/ }).first().click();
  await expect(page.getByRole("button", { name: /^5 [a-ząćęłńóśźż]+, [a-ząćęłńóśźż]+, wolne$/ }).first()).toBeVisible();
});

test("własna zmiana z przerwą", async ({ page }) => {
  await page.getByRole("button", { name: "Dodaj rodzaj zmiany" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nazwa", { exact: true }).fill("Dwunastka");
  await dialog.getByLabel("Od", { exact: true }).fill("07:00");
  await dialog.getByLabel("Do", { exact: true }).fill("19:00");
  await dialog.getByLabel("Przerwa", { exact: true }).fill("30");
  await expect(dialog).toContainText("11 h 30 min");
  await page.getByRole("button", { name: "Zapisz rodzaj" }).click();

  await expect(page.getByRole("radio", { name: /Dwunastka/ })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: /^10 [a-ząćęłńóśźż]+, [a-ząćęłńóśźż]+, wolne$/ }).first().click();
  await expect(page.getByRole("region", { name: "Podsumowanie miesiąca" })).toContainText("11 h 30 min");
});

test("cykl nakłada się na miesiąc i da się go cofnąć", async ({ page }) => {
  await page.getByRole("button", { name: "Cykl" }).click();
  const dialog = page.getByRole("dialog");
  // Domyślnie wybrany pierwszy zapisany cykl: 2× Dzień, 2× Noc, 4× wolne.
  await expect(dialog).toContainText("Kolejne dni cyklu (8)");
  await dialog.getByRole("button", { name: "Nałóż cykl" }).click();

  const summary = page.getByRole("region", { name: "Podsumowanie miesiąca" });
  await expect(summary).not.toContainText("Dni pracy0");
  await page.getByRole("button", { name: "Cofnij" }).click();
  await expect(summary).toContainText("Dni pracy0");
});

test("szczegóły dnia: dłużej niż w planie i notatka", async ({ page }) => {
  await page.getByRole("button", { name: /^1 [a-ząćęłńóśźż]+, [a-ząćęłńóśźż]+, wolne$/ }).first().click();
  await page.getByRole("radio", { name: "Szczegóły" }).click();
  await page.getByRole("button", { name: /^1 [a-ząćęłńóśźż]+, [a-ząćęłńóśźż]+, Dzień/ }).first().click();

  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Dodaj 15 minut" }).click();
  await dialog.getByRole("button", { name: "Dodaj 15 minut" }).click();
  await expect(dialog).toContainText("8 h 30 min");
  await dialog.getByLabel("Notatka").fill("zastępstwo");
  await dialog.getByRole("button", { name: "Zapisz dzień" }).click();

  await expect(page.getByRole("button", { name: /^1 [a-ząćęłńóśźż]+, [a-ząćęłńóśźż]+, Dzień.*odchylenie 30 min, notatka: zastępstwo/ }).first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Podsumowanie miesiąca" })).toContainText("8 h 30 min");
});

test("godziny wpisane ręcznie w oknie dnia zastępują godziny zmiany i przeżywają odświeżenie", async ({ page }) => {
  await page.getByRole("radio", { name: "Szczegóły" }).click();
  await page.getByRole("button", { name: /^1 [a-ząćęłńóśźż]+, [a-ząćęłńóśźż]+, wolne$/ }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: "Dzień" }).click();
  await expect(dialog.getByText(/Wg zmiany/)).toBeVisible();

  await dialog.getByLabel("Od", { exact: true }).fill("07:00");
  await dialog.getByLabel("Do", { exact: true }).fill("17:30");
  await dialog.getByLabel("Przerwa (min)").fill("30");
  await expect(dialog).toContainText("Ręcznie wpisane");
  await expect(dialog).toContainText("10 h");
  await dialog.getByRole("button", { name: "Zapisz dzień" }).click();

  const summary = page.getByRole("region", { name: "Podsumowanie miesiąca" });
  await expect(summary).toContainText("10 h");

  await page.reload();
  await expect(page.getByRole("region", { name: "Podsumowanie miesiąca" })).toContainText("10 h");
  await page.getByRole("radio", { name: "Szczegóły" }).click();
  await page.getByRole("button", { name: /^1 [a-ząćęłńóśźż]+, [a-ząćęłńóśźż]+, Dzień/ }).first().click();
  const again = page.getByRole("dialog");
  await expect(again.getByLabel("Do", { exact: true })).toHaveValue("17:30");
  await again.getByRole("button", { name: "Przywróć godziny zmiany" }).click();
  await expect(again.getByLabel("Do", { exact: true })).not.toHaveValue("17:30");
  await again.getByRole("button", { name: "Zapisz dzień" }).click();
  await expect(page.getByRole("region", { name: "Podsumowanie miesiąca" })).toContainText("8 h");
});

test("nieobecność obniża normę zamiast dodawać godziny", async ({ page }) => {
  const summary = page.getByRole("region", { name: "Podsumowanie miesiąca" });
  const normBefore = await summary.getByText(/h normy/).textContent();
  await page.getByRole("radio", { name: /Urlop/ }).click();
  await page.getByRole("button", { name: /^1 [a-ząćęłńóśźż]+, [a-ząćęłńóśźż]+, wolne$/ }).first().click();
  await expect(summary).toContainText("Dni pracy0");
  await expect(summary.getByText(/h normy/)).not.toHaveText(normBefore!);
});

test("eksport grafiku do kalendarza pobiera plik .ics", async ({ page }) => {
  await page.getByRole("button", { name: /^1 [a-ząćęłńóśźż]+, [a-ząćęłńóśźż]+, wolne$/ }).first().click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Do kalendarza (.ics)" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^grafik-\d{4}-\d{2}\.ics$/);
  const body = await (await download.createReadStream()).toArray();
  const text = Buffer.concat(body).toString("utf8");
  expect(text).toContain("SUMMARY:Zmiana: Dzień");
});

test("usunięcie rodzaju zmiany wymaga potwierdzenia i da się cofnąć", async ({ page }) => {
  await page.getByRole("button", { name: /^1 [a-ząćęłńóśźż]+, [a-ząćęłńóśźż]+, wolne$/ }).first().click();
  await page.getByRole("button", { name: /^2 [a-ząćęłńóśźż]+, [a-ząćęłńóśźż]+, wolne$/ }).first().click();

  await page.getByRole("button", { name: "Edytuj rodzaj Dzień" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Usuń rodzaj" }).click();
  // Pierwsze kliknięcie tylko pyta (z liczbą dni) — okno zostaje otwarte.
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Usunąć z 2 dniami?" }).click();

  await expect(page.getByRole("radio", { name: /Dzień/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^1 [a-ząćęłńóśźż]+, [a-ząćęłńóśźż]+, wolne$/ }).first()).toBeVisible();
  await page.getByRole("button", { name: "Cofnij" }).click();
  await expect(page.getByRole("radio", { name: /Dzień/ })).toHaveCount(1);
  await expect(page.getByRole("button", { name: /^2 [a-ząćęłńóśźż]+, [a-ząćęłńóśźż]+, Dzień/ }).first()).toBeVisible();
});

test("siatka obsługuje klawiaturę: jeden przystanek Tab, strzałki, Enter nanosi", async ({ page }) => {
  const grid = page.getByRole("grid");
  // Dziś (zegar zamrożony na 7.10.2026) ma fokus tabulatora.
  const today = grid.getByRole("button", { name: /^7 października, środa, dziś, wolne$/ });
  await expect(today).toHaveAttribute("tabindex", "0");
  await expect(today).toHaveAttribute("aria-current", "date");
  await today.focus();
  await page.keyboard.press("ArrowRight");
  const next = grid.getByRole("button", { name: /^8 października, czwartek, wolne$/ });
  await expect(next).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(grid.getByRole("button", { name: /^8 października, czwartek, Dzień/ })).toBeFocused();

  await page.keyboard.press("PageDown");
  await expect(page.getByRole("heading", { level: 2 })).toContainText(/listopad 2026/i);
  await expect(grid.getByRole("button", { name: /^8 listopada/ })).toBeFocused();
});

test("pędzle: strzałki wybierają sąsiedni, Cykl i + widoczne na telefonie", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await expect(page.getByRole("button", { name: "Cykl" })).toBeInViewport();
  await expect(page.getByRole("button", { name: "Dodaj rodzaj zmiany" })).toBeInViewport();
  const first = page.getByRole("radio", { name: /Dzień/ });
  await first.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("radio", { name: /Popołudnie/ })).toBeFocused();
  await expect(page.getByRole("radio", { name: /Popołudnie/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText(/^(Stuknij|Kliknij) dzień, żeby nanieść: Popołudnie./)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("usunięcie zapisanego cyklu nie kasuje układanych kroków", async ({ page }) => {
  await page.getByRole("button", { name: "Cykl" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Kolejne dni cyklu (8)");
  await dialog.getByRole("button", { name: "Dodaj do cyklu: Popołudnie" }).click();
  await dialog.getByRole("button", { name: /^Usuń cykl Trzyzmianowy/ }).click();
  await expect(dialog).toContainText("Kolejne dni cyklu (9)");
  await expect(dialog.getByRole("button", { name: /^Usuń cykl/ })).toHaveCount(1);
});

/** Okno „Ustawienia grafiku” — pola rozliczenia nie siedzą już w podsumowaniu. */
async function openSettings(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Ustawienia grafiku" }).click();
  const dialog = page.getByRole("dialog", { name: "Ustawienia grafiku" });
  await expect(dialog).toBeVisible();
  return dialog;
}

/** Stary zapis Grafiku (sprzed Yjs) — trafia do dokumentu przy pierwszym wczytaniu. */
async function withLegacyShifts(page: import("@playwright/test").Page, data: object) {
  await page.addInitScript((json) => {
    if (sessionStorage.getItem("legacy-seeded")) return;
    sessionStorage.setItem("legacy-seeded", "1");
    localStorage.setItem("kaczy:shifts", json);
  }, JSON.stringify({ version: 2, ...data }));
  await page.goto("/grafik");
}

test("bez rodzajów zmian widać, jak zacząć", async ({ page }) => {
  await withLegacyShifts(page, { types: [] });
  const empty = page.getByRole("region", { name: "Brak rodzajów zmian" });
  await expect(empty).toBeVisible();
  await empty.getByRole("button", { name: "Przywróć startowe" }).click();
  await expect(empty).toHaveCount(0);
  await expect(page.getByRole("radio", { name: /Dzień/ })).toHaveAttribute("aria-checked", "true");
});

test("stary grafik z localStorage przechodzi do nowego zapisu i przeżywa odświeżenie", async ({ page }) => {
  await withLegacyShifts(page, { days: { "2026-10-05": { type: "n", note: "stare" } }, hourlyRate: 40 });
  const day = page.getByRole("button", { name: /^5 [a-ząćęłńóśźż]+, [a-ząćęłńóśźż]+, Noc.*notatka: stare/ }).first();
  await expect(day).toBeVisible();
  await page.reload();
  await expect(day).toBeVisible();
  await expect((await openSettings(page)).getByLabel("Stawka za godzinę")).toHaveValue("40");
});

test("wyczyszczenie dnia z notatką da się cofnąć", async ({ page }) => {
  await page.getByRole("button", { name: /^1 [a-ząćęłńóśźż]+, [a-ząćęłńóśźż]+, wolne$/ }).first().click();
  await page.getByRole("radio", { name: "Szczegóły" }).click();
  await page.getByRole("button", { name: /^1 [a-ząćęłńóśźż]+, [a-ząćęłńóśźż]+, Dzień/ }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Notatka").fill("zastępstwo");
  await dialog.getByRole("button", { name: "Zapisz dzień" }).click();

  await page.getByRole("radio", { name: "Wolne" }).click();
  await page.getByRole("button", { name: /^1 [a-ząćęłńóśźż]+, [a-ząćęłńóśźż]+, Dzień/ }).first().click();
  await expect(page.getByRole("button", { name: /^1 [a-ząćęłńóśźż]+, [a-ząćęłńóśźż]+, wolne$/ }).first()).toBeVisible();
  await page.getByRole("button", { name: "Cofnij" }).click();
  await expect(page.getByRole("button", { name: /^1 [a-ząćęłńóśźż]+, [a-ząćęłńóśźż]+, Dzień.*notatka: zastępstwo/ }).first()).toBeVisible();
});

test("awaria widoku Grafiku nie zabiera reszty aplikacji", async ({ page }) => {
  await page.route(/ShiftsView/, (route) => route.abort());
  await page.goto("/grafik");
  await expect(page.getByRole("alert")).toContainText("Grafik: nie udało się wyświetlić widoku");
  await expect(page.getByRole("button", { name: "Odśwież stronę" })).toBeVisible();
  // Reszta aplikacji działa: można przejść do notatek.
  await page.getByRole("button", { name: "Notatki" }).first().click();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("bez internetu niepobrany Grafik mówi, że czeka na sieć", async ({ page, context }) => {
  await page.route(/ShiftsView/, (route) => route.abort());
  await page.goto("/");
  // Bez SW w testach leniwe części (np. samouczek) muszą się pobrać, zanim odetniemy sieć.
  await page.waitForLoadState("networkidle");
  await context.setOffline(true);
  await page.getByRole("button", { name: "Grafik" }).first().click();
  const panel = page.locator('[data-status="offline"]');
  // Ponowne wyrenderowanie po odcięciu sieci bywa wolne przy obciążonym przebiegu — dłuższy limit tylko tej asercji.
  await expect(panel).toContainText("Grafik: ten widok potrzebuje internetu", { timeout: 15_000 });
  await expect(panel).toHaveAttribute("role", "status");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await context.setOffline(false);
});

test("ostrzega o odpoczynku krótszym niż 11 h", async ({ page }) => {
  await page.getByRole("radio", { name: /Popołudnie/ }).click();
  await page.getByRole("button", { name: /^5 [a-ząćęłńóśźż]+, [a-ząćęłńóśźż]+, wolne$/ }).first().click();
  await page.getByRole("radio", { name: /Dzień/ }).click();
  await page.getByRole("button", { name: /^6 [a-ząćęłńóśźż]+, [a-ząćęłńóśźż]+, wolne$/ }).first().click();
  await expect(page.getByRole("note")).toContainText("Za krótki odpoczynek");
  await expect(page.getByRole("note")).toContainText("6 października — 8 h");
});

test("okres rozliczeniowy kwartał: postęp okresu i nadgodziny w ostatnim miesiącu", async ({ page }) => {
  const summary = page.getByRole("region", { name: "Podsumowanie miesiąca" });
  await (await openSettings(page)).getByLabel("Okres rozliczeniowy").selectOption({ label: "3 miesiące (kwartał)" });
  await page.keyboard.press("Escape");
  await expect(summary).toContainText(/Okres paź–gru 2026/);
  await expect(summary).toContainText("Nadgodziny ponad normę okresu policzymy w grudniu");
  await page.reload();
  await expect((await openSettings(page)).getByLabel("Okres rozliczeniowy")).toHaveValue("3");
});

test("pół etatu: niższa norma i godziny ponadwymiarowe", async ({ page }) => {
  const summary = page.getByRole("region", { name: "Podsumowanie miesiąca" });
  const normFull = await summary.getByText(/h normy/).textContent();
  await (await openSettings(page)).getByLabel("Wymiar etatu").selectOption({ label: "1/2" });
  await page.keyboard.press("Escape");
  await expect(summary.getByText(/h normy/)).not.toHaveText(normFull!);
  await expect(summary).toContainText("/ 88 h normy");
  await page.reload();
  await expect((await openSettings(page)).getByLabel("Wymiar etatu")).toHaveValue("0.5");
});

test("nowe godziny rodzaju obowiązują od dziś, przeszłe dni zostają przy starych", async ({ page }) => {
  await page.getByRole("button", { name: /^1 [a-ząćęłńóśźż]+, [a-ząćęłńóśźż]+, wolne$/ }).first().click();
  await page.getByRole("button", { name: /^20 [a-ząćęłńóśźż]+, [a-ząćęłńóśźż]+, wolne$/ }).first().click();
  await page.getByRole("button", { name: "Edytuj rodzaj Dzień" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Od", { exact: true }).fill("07:00");
  await dialog.getByLabel("Do", { exact: true }).fill("17:00");
  await expect(dialog).toContainText("dni wcześniejsze zachowają dotychczasowe");
  await dialog.getByRole("button", { name: "Zapisz rodzaj" }).click();

  await expect(page.getByRole("button", { name: /^1 [a-ząćęłńóśźż]+, [a-ząćęłńóśźż]+, Dzień 06:00–14:00/ }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /^20 [a-ząćęłńóśźż]+, [a-ząćęłńóśźż]+, Dzień 07:00–17:00/ }).first()).toBeVisible();
});

test("zmiana z Grafiku widać w komórce Kalendarza i w panelu dnia", async ({ page }) => {
  await page.getByRole("button", { name: /^5 [a-ząćęłńóśźż]+, [a-ząćęłńóśźż]+, wolne$/ }).first().click();

  await page.getByRole("button", { name: /Kalendarz/ }).first().click();
  const cell = page.getByRole("gridcell", { name: /^[^,]+, 5 października 2026.*zmiana: Dzień \d{2}:\d{2}–\d{2}:\d{2}/ });
  await expect(cell).toHaveCount(1);

  await cell.click();
  await expect(page.getByText(/Zmiana w Grafiku:/)).toBeVisible();
  // Dzień bez zmiany nie ma znacznika.
  await expect(page.getByRole("gridcell", { name: /^[^,]+, 6 października 2026/ })).not.toContainText("zmiana:");
});

test("Kalendarz pokazuje dziś i jutro: zmianę z Grafiku i brak terminów", async ({ page }) => {
  await page.getByRole("button", { name: /^7 [a-ząćęłńóśźż]+, .*wolne$/ }).first().click();
  await page.getByRole("button", { name: /Kalendarz/ }).first().click();

  const today = page.getByRole("region", { name: "Dziś i jutro" });
  await expect(today).toContainText("Dziś");
  await expect(today).toContainText("środa, 7 października");
  await expect(today).toContainText("Zmiana w Grafiku: Dzień");
  await expect(today).toContainText("Bez zmiany w Grafiku"); // jutro

  // Klik w kartę przenosi panel dnia na ten dzień.
  await today.getByRole("button", { name: /Jutro/ }).click();
  await expect(page.getByRole("heading", { name: /czwartek, 8 października/i })).toBeVisible();
});

test("wieczorne przypomnienie o jutrzejszej zmianie pojawia się raz", async ({ page }) => {
  await page.evaluate(() => localStorage.setItem("kaczy:shifts.eveningNudge", "00:00"));
  // Środa 7.10 (dziś) — jutro to czwartek 8.10.
  await page.getByRole("button", { name: /^8 [a-ząćęłńóśźż]+, [a-ząćęłńóśźż]+, wolne$/ }).first().click();
  await expect(page.getByText(/Jutro: Dzień \d{2}:\d{2}–\d{2}:\d{2}/)).toBeVisible({ timeout: 15000 });
  expect(await page.evaluate(() => localStorage.getItem("kaczy:shifts.eveningNudged"))).toBe("2026-10-08");
});

test("godzinę przypomnienia o zmianie ustawia się w ustawieniach grafiku", async ({ page }) => {
  const settings = await openSettings(page);
  await settings.getByLabel("Przypomnienie o jutrzejszej zmianie").selectOption("20:00");
  expect(await page.evaluate(() => localStorage.getItem("kaczy:shifts.eveningNudge"))).toBe("20:00");
});

test("paleta poleceń znajduje dzień grafiku i otwiera jego okno", async ({ page }) => {
  await page.getByRole("button", { name: /^14 [a-ząćęłńóśźż]+, [a-ząćęłńóśźż]+, wolne$/ }).first().click();
  await page.goto("/");
  await page.keyboard.press("ControlOrMeta+k");
  const input = page.getByRole("dialog").getByPlaceholder(/Szukaj/i);
  await input.fill("14 października");
  const hit = page.getByRole("option", { name: /środa, 14 października|14 października/i }).filter({ hasText: "Dzień" });
  await expect(hit).toHaveCount(1);
  await hit.click();
  await expect(page.getByRole("heading", { name: "Grafik", level: 1 })).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("14 października");
});

test("telefon: eksporty Grafiku są w menu „Udostępnij” @mobile", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("iphone"), "tylko układ telefonu");
  await page.goto("/grafik");
  await page.getByRole("button", { name: "Udostępnij", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: /Do kalendarza \(\.ics\)/ })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: /Karta czasu/ })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: /Obraz miesiąca/ })).toBeVisible();
});

test("cykl: „Przedłuż cykl” zaczyna od dnia po ostatnim nałożonym", async ({ page }) => {
  await page.getByRole("button", { name: "Cykl" }).click();
  let dialog = page.getByRole("dialog");
  // Wczytanie zapisanego cyklu (pierwszy na liście), żeby zapamiętać kotwicę i ostatni dzień.
  await dialog.locator("fieldset").first().getByRole("button").first().click();
  await dialog.getByRole("button", { name: "Nałóż cykl" }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("button", { name: "Cykl" }).click();
  dialog = page.getByRole("dialog");
  await dialog.locator("fieldset").first().getByRole("button").first().click();
  await expect(dialog.getByRole("button", { name: /^Przedłuż cykl od / })).toBeVisible();
  await dialog.getByRole("button", { name: /^Przedłuż cykl od / }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(/Nałożono cykl na \d+ dni/).first()).toBeVisible();
});
