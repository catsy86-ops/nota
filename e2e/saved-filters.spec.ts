import { test, expect, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    // Tylko pierwsze wejście czyści stan — przetrwanie reloadu sprawdzamy na tym samym profilu.
    if (!sessionStorage.getItem("sf-seeded")) {
      localStorage.removeItem("kaczy.savedFilters.v1");
      sessionStorage.setItem("sf-seeded", "1");
    }
  });
  await page.goto("/");
});

async function addNote(page: Page, title: string) {
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(title);
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(page.getByText("Zapisz notatkę...")).toBeVisible();
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
}

const search = (page: Page) => page.getByRole("searchbox").first();
const filters = (page: Page) => page.locator("[data-saved-filters]");

test("zapisany filtr: zapis, użycie z paska, reload i usunięcie", async ({ page }) => {
  // Każdy test ma świeży kontekst; różne słowa, żeby Fuse nie zlewał obu notatek.
  const alpha = "Kalafior";
  const beta = "Rutabaga";
  await addNote(page, alpha);
  await addNote(page, beta);

  // Operator + tekst: zawęża do jednej notatki.
  const query = `brak:przypomnienia ${alpha}`;
  await search(page).fill(query);
  await expect(page.locator("[data-note-id]").filter({ hasText: alpha })).toBeVisible();
  await expect(page.locator("[data-note-id]").filter({ hasText: beta })).toHaveCount(0);

  await page.getByRole("button", { name: "Zapisz wyszukiwanie jako filtr" }).first().click();
  await page.getByLabel("Nazwa filtra").fill("Tylko alfa");
  await page.getByRole("button", { name: "Zapisz filtr" }).click();

  const row = filters(page).getByRole("button", { name: /Tylko alfa/ });
  await expect(row).toBeVisible();
  await expect(row).toContainText("1");
  await expect(row).toHaveAttribute("aria-current", "page");

  // Wyczyść zapytanie, a potem użyj filtra z paska.
  await page.getByRole("button", { name: "Wyczyść wyszukiwanie" }).first().click();
  await expect(page.locator("[data-note-id]").filter({ hasText: beta })).toBeVisible();
  await expect(row).not.toHaveAttribute("aria-current", "page");
  await row.click();
  await expect(search(page)).toHaveValue(query);
  await expect(page.locator("[data-note-id]").filter({ hasText: beta })).toHaveCount(0);
  await expect(page.locator("[data-note-id]").filter({ hasText: alpha })).toBeVisible();

  // Filtr przetrwa odświeżenie strony.
  await page.reload();
  await expect(filters(page).getByRole("button", { name: /Tylko alfa/ })).toBeVisible();

  // Usunięcie z menu wiersza.
  const reloaded = filters(page).getByRole("button", { name: /Tylko alfa/ });
  await reloaded.hover();
  await page.getByRole("button", { name: "Akcje filtra Tylko alfa" }).click();
  await page.getByRole("menuitem", { name: "Usuń filtr" }).click();
  await expect(filters(page)).toHaveCount(0);
});

test("zmiana nazwy filtra i podpowiedzi operatorów", async ({ page }) => {
  await search(page).fill("ma:przypomnienie");
  await page.getByRole("button", { name: "Zapisz wyszukiwanie jako filtr" }).first().click();
  await page.getByLabel("Nazwa filtra").fill("Z terminem");
  await page.keyboard.press("Enter");
  await expect(filters(page).getByRole("button", { name: /Z terminem/ })).toBeVisible();

  const row = filters(page).getByRole("button", { name: /Z terminem/ });
  await row.hover();
  await page.getByRole("button", { name: "Akcje filtra Z terminem" }).click();
  await page.getByRole("menuitem", { name: "Zmień nazwę" }).click();
  await page.getByLabel("Nazwa filtra").fill("Terminy");
  await page.keyboard.press("Enter");
  await expect(filters(page).getByRole("button", { name: /Terminy/ })).toBeVisible();

  // Podpowiedzi: po „br” pojawia się operator, wybór wstawia go do pola.
  await search(page).fill("br");
  await page.getByRole("option", { name: "brak:przypomnienia" }).click();
  await expect(search(page)).toHaveValue("brak:przypomnienia ");
});
