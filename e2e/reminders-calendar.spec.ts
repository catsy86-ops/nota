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
  await page.getByPlaceholder(/Szukaj/i).first().fill("Kalendarz");
  // Klik w pozycję palety bywa niestabilny w trakcie jej animacji, więc wybieramy
  // ją Enterem — ale dopiero gdy cmdk faktycznie ją podświetli.
  await expect(page.getByRole("option", { name: /Kalendarz/, selected: true })).toBeVisible();
  await page.keyboard.press("Enter");
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
