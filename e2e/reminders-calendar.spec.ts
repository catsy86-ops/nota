import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

test("kalendarz otwiera się z paska bocznego i pozwala przechodzić po miesiącach", async ({ page }) => {
  await page.getByRole("button", { name: /Kalendarz/ }).first().click();

  const heading = page.getByRole("heading", { level: 2 });
  await expect(heading).toBeVisible();
  const startMonth = (await heading.textContent())?.trim();

  // Bieżący miesiąc nie potrzebuje skrótu „Dziś".
  await expect(page.getByRole("button", { name: "Wróć do bieżącego miesiąca" })).toHaveCount(0);

  await page.getByRole("button", { name: "Następny miesiąc" }).click();
  await expect(heading).not.toHaveText(startMonth!);

  const backToToday = page.getByRole("button", { name: "Wróć do bieżącego miesiąca" });
  await expect(backToToday).toBeVisible();
  await backToToday.click();
  await expect(heading).toHaveText(startMonth!);
});

test("kalendarz jest osiągalny z palety poleceń", async ({ page }) => {
  await page.keyboard.press("ControlOrMeta+k");
  // Pole palety trzeba wskazać przez jej dialog — pasek wyszukiwania strony
  // ma bardzo podobny placeholder.
  const paletteInput = page.getByRole("dialog").getByPlaceholder(/Szukaj/i);
  await paletteInput.fill("Kalendarz");
  // Klikamy dopiero, gdy lista przefiltruje się do jednej pozycji: wcześniej
  // cmdk podmienia węzły i klik trafia w element, który właśnie znika.
  const option = page.getByRole("option", { name: /Kalendarz/ });
  await expect(option).toHaveCount(1);
  await option.click();
  // Na stronie są dwa h1: nazwa aplikacji w pasku bocznym i tytuł widoku.
  await expect(page.getByRole("heading", { name: "Kalendarz", level: 1 })).toBeVisible();
});

test("siatka miesiąca pokazuje termin w komórce dnia i w panelu dnia", async ({ page }) => {
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill("Oddac ksiazke");
  await page.getByRole("button", { name: "Zamknij" }).click();

  // Popover pickera rozwija się pod kartą i przy niskim oknie wychodzi poza ekran.
  await page.setViewportSize({ width: 1280, height: 1000 });

  const card = page.locator("[data-note-id-wrap]", { hasText: "Oddac ksiazke" });
  await card.hover();
  await card.getByRole("button", { name: "Przypomnienie" }).click();
  // Ostatni dzień miesiąca: na pewno w bieżącym miesiącu i nieodfiltrowany
  // blokadą „data w przeszłości". Godzina późna, żeby termin nie wypadł
  // w przeszłości, gdy test biegnie po południu.
  const pickerDay = page.getByRole("gridcell", { disabled: false }).last();
  const dayNumber = (await pickerDay.textContent())!.trim();
  await pickerDay.click();
  await page.locator('input[type="time"]').fill("23:59");
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();

  await page.getByRole("button", { name: /Kalendarz/ }).first().click();

  const grid = page.getByRole("grid", { name: /Kalendarz przypomnień/ });
  // Picker może wskazać dzień z początku kolejnego miesiąca — siatka i tak go
  // pokazuje, bo obejmuje wiodące i zamykające dni sąsiednich miesięcy.
  // Szukamy więc jedynej komórki z terminem i sprawdzamy, że to właściwy dzień.
  const cell = grid.getByRole("gridcell", { name: /1 termin/ });
  await expect(cell).toHaveCount(1);
  await expect(cell).toHaveAttribute("aria-label", new RegExp(`^${dayNumber} `));

  await cell.click();
  // Panel dnia to lista — kafel w siatce ma ten sam tekst, więc celujemy w pozycję listy.
  await expect(page.getByRole("listitem").filter({ hasText: "Oddac ksiazke" })).toHaveCount(1);
});

test("po siatce da się chodzić strzałkami, a PageDown przewija miesiąc", async ({ page }) => {
  await page.getByRole("button", { name: /Kalendarz/ }).first().click();

  const grid = page.getByRole("grid", { name: /Kalendarz przypomnień/ });
  const monthHeading = page.getByRole("heading", { level: 2 });
  const startMonth = (await monthHeading.textContent())!.trim();

  // Siatka to jeden przystanek tabulatora — fokus bierze dzień zaznaczony.
  const selected = grid.getByRole("gridcell", { selected: true });
  await expect(selected).toHaveCount(1);
  const startLabel = await selected.getAttribute("aria-label");

  await selected.click();
  await page.keyboard.press("ArrowRight");
  const afterRight = grid.getByRole("gridcell", { selected: true });
  await expect(afterRight).not.toHaveAttribute("aria-label", startLabel!);
  // Zaznaczony jest zawsze dokładnie jeden dzień.
  await expect(afterRight).toHaveCount(1);

  await page.keyboard.press("PageDown");
  await expect(monthHeading).not.toHaveText(startMonth);
});

test("z kalendarza da się dodać termin, edytować go i usunąć", async ({ page }) => {
  await page.getByRole("button", { name: /Kalendarz/ }).first().click();
  await page.getByRole("button", { name: "Dodaj termin" }).click();

  // Język naturalny z początku wpisu ustawia dzień, reszta zostaje tytułem.
  await page.getByLabel("Treść nowej notatki z terminem").fill("jutro odebrac paczke");
  await expect(page.getByText(/Rozpoznano datę/)).toBeVisible();
  await page.getByLabel("Godzina przypomnienia").fill("18:30");
  await page.getByRole("button", { name: /Utwórz notatkę z terminem/ }).click();

  // Termin ląduje w jutrzejszej komórce, więc panel dnia trzeba na nią przestawić.
  const grid = page.getByRole("grid", { name: /Kalendarz przypomnień/ });
  const cell = grid.getByRole("gridcell", { name: /1 termin/ });
  await expect(cell).toHaveCount(1);
  await cell.click();

  const row = page.getByRole("listitem").filter({ hasText: "odebrac paczke" });
  await expect(row).toHaveCount(1);
  // Prefiks daty nie może zostać w tytule notatki.
  await expect(row).not.toContainText("jutro");
  await expect(row).toContainText("18:30");

  // Edycja: zmiana godziny na istniejącym terminie.
  await page.getByRole("button", { name: /Edytuj termin/ }).click();
  await page.getByLabel("Godzina przypomnienia").fill("07:15");
  await page.getByRole("button", { name: "Zapisz termin" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "odebrac paczke" })).toContainText("07:15");

  // Usunięcie terminu zostawia notatkę, ale zdejmuje ją z kalendarza.
  await page.getByRole("button", { name: /Edytuj termin/ }).click();
  await page.getByRole("button", { name: "Usuń termin" }).click();
  await expect(grid.getByRole("gridcell", { name: /1 termin/ })).toHaveCount(0);
  await expect(page.getByText("Termin usunięty")).toBeVisible();
});

test("termin można przypiąć do istniejącej notatki zamiast tworzyć nową", async ({ page }) => {
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill("Zadzwonic do ksiegowej");
  await page.getByRole("button", { name: "Zamknij" }).click();

  await page.getByRole("button", { name: /Kalendarz/ }).first().click();
  await page.getByRole("button", { name: "Dodaj termin" }).click();
  await page.getByLabel("Godzina przypomnienia").fill("23:45");

  await page.getByRole("button", { name: /Zadzwonic do ksiegowej/ }).click();

  await expect(page.getByText("Termin zapisany")).toBeVisible();
  const row = page.getByRole("listitem").filter({ hasText: "Zadzwonic do ksiegowej" });
  await expect(row).toContainText("23:45");
});

/** Tworzy notatkę z cotygodniowym przypomnieniem i wchodzi w kalendarz. */
async function seedWeeklySeries(page: import("@playwright/test").Page, title: string) {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(title);
  await page.getByRole("button", { name: "Zamknij" }).click();

  const card = page.locator("[data-note-id-wrap]", { hasText: title });
  await card.hover();
  await card.getByRole("button", { name: "Przypomnienie" }).click();
  // Początek widocznego miesiąca w pickerze bywa w przeszłości — bierzemy
  // pierwszy dozwolony dzień i późną godzinę, żeby termin był w przyszłości.
  await page.getByRole("gridcell", { disabled: false }).first().click();
  await page.locator('input[type="time"]').fill("23:30");
  await page.locator("select").selectOption("weekly");
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();

  await page.getByRole("button", { name: /Kalendarz/ }).first().click();
}

test("seria pokazuje prognozy, a edytować da się tylko najbliższy termin", async ({ page }) => {
  await seedWeeklySeries(page, "Przeglad tygodnia");

  const grid = page.getByRole("grid", { name: /Kalendarz przypomnień/ });
  // Cotygodniowa seria daje w miesiącu więcej niż jedno wystąpienie.
  await expect(grid.getByRole("gridcell", { name: /1 termin/ })).not.toHaveCount(0);

  // Najbliższe wystąpienie: pełna edycja.
  const first = grid.getByRole("gridcell", { name: /1 termin/ }).first();
  await first.click();
  await page.getByRole("button", { name: /^Edytuj termin/ }).click();
  await expect(page.getByRole("button", { name: "Pomiń to wystąpienie" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Usuń całą serię" })).toBeVisible();
  await page.keyboard.press("Escape");

  // Dalsze wystąpienie: prognoza, bez edycji — klik prowadzi do zapisanego terminu.
  const later = grid.getByRole("gridcell", { name: /1 termin/ }).nth(1);
  await later.click();
  const forecastRow = page.getByRole("button", { name: /Prognoza serii/ });
  await expect(forecastRow).toHaveCount(1);
  await expect(page.getByText("Prognoza serii — zapisany jest tylko najbliższy termin.")).toBeVisible();
  await forecastRow.click();
  await expect(page.getByText("To była prognoza serii")).toBeVisible();
  await expect(page.getByRole("button", { name: "Pomiń to wystąpienie" })).toBeVisible();
});

test("pominięcie wystąpienia przesuwa serię na kolejny termin, dalsze zostają", async ({ page }) => {
  await seedWeeklySeries(page, "Podlac kwiaty");

  const grid = page.getByRole("grid", { name: /Kalendarz przypomnień/ });
  const before = await grid.getByRole("gridcell", { name: /1 termin/ }).count();

  const first = grid.getByRole("gridcell", { name: /1 termin/ }).first();
  const firstLabel = await first.getAttribute("aria-label");
  await first.click();
  await page.getByRole("button", { name: /^Edytuj termin/ }).click();
  await page.getByRole("button", { name: "Pomiń to wystąpienie" }).click();

  await expect(page.getByText("Wystąpienie pominięte")).toBeVisible();
  // Pominięty dzień znika, ale seria trwa — zostaje o jedno wystąpienie mniej.
  await expect(grid.getByRole("gridcell", { name: /1 termin/ })).toHaveCount(before - 1);
  await expect(grid.getByRole("gridcell", { name: firstLabel! })).toHaveCount(0);
});

test("usunięcie całej serii zdejmuje wszystkie jej wystąpienia", async ({ page }) => {
  await seedWeeklySeries(page, "Cotygodniowy raport");

  const grid = page.getByRole("grid", { name: /Kalendarz przypomnień/ });
  await grid.getByRole("gridcell", { name: /1 termin/ }).first().click();
  await page.getByRole("button", { name: /^Edytuj termin/ }).click();
  await page.getByRole("button", { name: "Usuń całą serię" }).click();

  await expect(page.getByText("Termin usunięty")).toBeVisible();
  await expect(grid.getByRole("gridcell", { name: /\d+ termin/ })).toHaveCount(0);
});
