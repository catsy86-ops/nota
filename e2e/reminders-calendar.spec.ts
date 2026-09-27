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
  // Liczymy dopiero, gdy siatka pokaże serię: `count()` nie czeka, więc bez
  // tego zapewnienia licznik potrafił złapać jeszcze puste wystąpienia
  // (chunk kalendarza dochodzi przez `lazy()`) i porównanie było bezsensowne.
  await expect(grid.getByRole("gridcell", { name: /1 termin/ })).not.toHaveCount(0);
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

test("na wąskim ekranie kalendarz nie rozpycha strony, a dialog terminu jest osiągalny", async ({ page }) => {
  // Najwęższy telefon, jaki wciąż warto obsługiwać (iPhone SE 1. gen. / 320 px).
  await page.setViewportSize({ width: 320, height: 568 });
  await page.reload();

  // Pasek boczny jest na telefonie ukryty — wejście idzie przez arkusz „Więcej".
  await page.getByRole("button", { name: "Więcej" }).click();
  await page.getByRole("button", { name: "Kalendarz" }).click();
  await expect(page.getByRole("heading", { name: "Kalendarz", level: 1 })).toBeVisible();

  // Nagłówek miesiąca z przyciskiem „Dziś" mieścił się wcześniej tylko przez
  // przypadek: sztywne `min-w-[11ch]` przy dłuższej nazwie miesiąca rozpychało
  // stronę w poziomie. Przewijanie w bok jest tu zawsze błędem układu.
  await page.getByRole("button", { name: "Następny miesiąc" }).click();
  await expect(page.getByRole("button", { name: "Wróć do bieżącego miesiąca" })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await page.getByRole("button", { name: "Wróć do bieżącego miesiąca" }).click();

  // Dodanie terminu: dialog musi zmieścić się w 568 px wysokości razem
  // z przyciskiem zapisu, inaczej na telefonie nie da się go dokończyć.
  await page.getByRole("button", { name: "Dodaj termin" }).click();
  await page.getByLabel("Treść nowej notatki z terminem").fill("jutro kupic mleko");
  await page.getByLabel("Godzina przypomnienia").fill("18:30");
  const create = page.getByRole("button", { name: /Utwórz notatkę z terminem/ });
  await expect(create).toBeInViewport();
  await create.click();

  // Poniżej `sm` komórka rysuje kropki, nie chipy z godziną — ale treść dnia
  // zostaje w `aria-label`, więc czytnik ekranu nic nie traci.
  const grid = page.getByRole("grid", { name: /Kalendarz przypomnień/ });
  const cell = grid.getByRole("gridcell", { name: /1 termin/ });
  await expect(cell).toHaveCount(1);
  // `toContainText` widziałoby chip ukryty CSS-em (jest w DOM), więc pytamy
  // o widoczność: godzina na wąskim ekranie nie jest rysowana.
  await expect(cell.getByText("18:30")).toBeHidden();
  await cell.click();
  await expect(page.getByRole("listitem").filter({ hasText: "kupic mleko" })).toContainText("18:30");

  // Edycja na telefonie: „Usuń termin" bywało poza widokiem, bo dialog
  // nie przewijał się wcale.
  await page.getByRole("button", { name: /^Edytuj termin/ }).click();
  const remove = page.getByRole("button", { name: "Usuń termin" });
  await remove.scrollIntoViewIfNeeded();
  await remove.click();
  await expect(grid.getByRole("gridcell", { name: /1 termin/ })).toHaveCount(0);
});

test("termin da się przeciągnąć na inny dzień, przesunąć Shift+strzałką i cofnąć", async ({ page }) => {
  await page.getByRole("button", { name: /Kalendarz/ }).first().click();
  await page.getByRole("button", { name: "Dodaj termin" }).click();
  await page.getByLabel("Treść nowej notatki z terminem").fill("jutro podlac kwiaty");
  await page.getByLabel("Godzina przypomnienia").fill("18:30");
  await page.getByRole("button", { name: /Utwórz notatkę z terminem/ }).click();

  const grid = page.getByRole("grid", { name: /Kalendarz przypomnień/ });
  const source = grid.getByRole("gridcell", { name: /1 termin/ });
  await expect(source).toHaveCount(1);
  const sourceLabel = (await source.getAttribute("aria-label"))!;

  // Przeciągnięcie myszą o jedną komórkę w prawo (lub w lewo w niedzielę).
  const chip = source.locator(".cursor-grab");
  const from = (await chip.boundingBox())!;
  const cellBox = (await source.boundingBox())!;
  const dx = cellBox.x + cellBox.width * 1.5 < (page.viewportSize()!.width - 40) ? cellBox.width + 8 : -(cellBox.width + 8);
  await page.mouse.move(from.x + 5, from.y + 5);
  await page.mouse.down();
  await page.mouse.move(from.x + 5 + dx / 2, from.y + 5, { steps: 5 });
  await page.mouse.move(from.x + 5 + dx, from.y + 5, { steps: 5 });
  await page.mouse.up();

  await expect(page.getByText(/Termin przeniesiony na/)).toBeVisible();
  await expect(grid.getByRole("gridcell", { name: sourceLabel })).toHaveCount(0);
  const moved = grid.getByRole("gridcell", { name: /1 termin/ });
  await expect(moved).toHaveCount(1);
  const movedLabel = (await moved.getAttribute("aria-label"))!;
  expect(movedLabel).not.toBe(sourceLabel);

  // Klawiaturowy odpowiednik (WCAG 2.5.7): Shift+← w panelu dnia.
  await page.getByRole("button", { name: /Edytuj termin/ }).focus();
  await page.keyboard.press("Shift+ArrowLeft");
  await expect(page.getByText(/Termin przeniesiony na/).first()).toBeVisible();
  await expect(grid.getByRole("gridcell", { name: movedLabel })).toHaveCount(0);

  // Cofnij przywraca termin sprzed ostatniego przesunięcia.
  // Toasty się nakładają — klikamy w ten na wierzchu, czyli najnowszy.
  await page.locator("[data-sonner-toast][data-front=true]").getByRole("button", { name: "Cofnij" }).click();
  await expect(grid.getByRole("gridcell", { name: movedLabel })).toHaveCount(1);
});
