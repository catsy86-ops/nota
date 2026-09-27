import { test, expect, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

async function addNote(page: Page, title: string) {
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(title);
  await page.getByRole("button", { name: "Zamknij" }).click();
}

test("edycja nie ginie, gdy kafel wypada z filtra wyszukiwania", async ({ page }) => {
  const title = `E2E-autosave ${Date.now()}`;
  await addNote(page, title);

  await page.getByText(title).click();
  const body = page.getByPlaceholder("Treść (obsługuje **Markdown**)...");
  await body.fill("akapit, którego nikt nie zapisał ręcznie");

  // Wpisanie czegoś w wyszukiwanie odmontowuje kafel bez kliknięcia „Zapisz”.
  // Wcześniej treść przepadała bez słowa.
  const search = page.getByPlaceholder("Szukaj notatek...").first();
  await search.fill("zupełnie-inna-fraza-bez-trafien");
  await expect(page.getByText(title)).toHaveCount(0);

  await search.fill("");
  await expect(page.getByText("akapit, którego nikt nie zapisał ręcznie")).toBeVisible();
});

test("Delete wyrzuca do kosza dokładnie jedną notatkę, gdy inna jest przypięta", async ({ page }) => {
  const stamp = Date.now();
  const pinnedTitle = `E2E-pin ${stamp}`;
  const plainTitle = `E2E-plain ${stamp}`;

  await addNote(page, pinnedTitle);
  await addNote(page, plainTitle);

  // Przypnij pierwszą — strona renderuje wtedy dwie siatki („Przypięte" i „Inne").
  const pinnedCard = page.locator(`[data-note-id-wrap]`, { hasText: pinnedTitle });
  await pinnedCard.hover();
  await pinnedCard.getByRole("button", { name: "Przypnij" }).click();
  await expect(page.getByText("Przypięte")).toBeVisible();

  // Bez klikania w kafel (to otwiera edytor i przechwytuje klawiaturę):
  // „End" ustawia fokus na ostatniej notatce płaskiej listy, czyli nieprzypiętej.
  await page.keyboard.press("End");
  await page.keyboard.press("Delete");

  // Potwierdzenie dotyczy dokładnie jednej notatki — wcześniej druga siatka
  // kasowała przy tym samym klawiszu swoją własną.
  const confirm = page.getByRole("alertdialog", { name: "Przenieść do kosza?" });
  await expect(confirm).toContainText(plainTitle);
  await expect(confirm).not.toContainText(pinnedTitle);
  await confirm.getByRole("button", { name: "Przenieś do kosza" }).click();

  // Przypięta notatka musi przeżyć.
  await expect(page.getByRole("heading", { name: pinnedTitle })).toBeVisible();
  await expect(page.getByRole("heading", { name: plainTitle })).toHaveCount(0);
});

test("pełnoekranowy edytor zapisuje treść po zamknięciu klawiszem Esc", async ({ page }) => {
  const title = `E2E-full ${Date.now()}`;
  await addNote(page, title);

  await page.getByText(title).click();
  await page.getByRole("button", { name: "Pełny ekran" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  // Rozwinięcie przenosi szkic, a nie zaczyna od nowa.
  await expect(dialog.getByPlaceholder("Tytuł")).toHaveValue(title);
  await dialog.getByPlaceholder("Treść (obsługuje **Markdown**)...").fill("notatka ze spotkania w dużym oknie");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("notatka ze spotkania w dużym oknie")).toBeVisible();
});
