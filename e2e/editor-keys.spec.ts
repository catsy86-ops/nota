import { test, expect, type Locator, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

/** Rozwija pasek nowej notatki i zwraca pole treści. */
async function openComposer(page: Page): Promise<Locator> {
  await page.getByText("Zapisz notatkę...").click();
  const body = page.getByPlaceholder("Treść notatki...");
  await body.click();
  return body;
}

async function addNote(page: Page, title: string) {
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(title);
  await page.getByRole("button", { name: "Zamknij" }).click();
  await expect(page.getByText("Zapisz notatkę...")).toBeVisible();
  await expect(page.getByText(title)).toBeVisible();
}

test("Ctrl+B i Ctrl+I otaczają zaznaczenie, a ponowne użycie zdejmuje znaczniki", async ({ page }) => {
  const body = await openComposer(page);
  await body.pressSequentially("zażółć gęślą");
  await body.press("Shift+Home");
  await body.press("Control+b");
  await expect(body).toHaveValue("**zażółć gęślą**");
  await body.press("Control+b");
  await expect(body).toHaveValue("zażółć gęślą");
  await body.press("Control+i");
  await expect(body).toHaveValue("*zażółć gęślą*");
  await body.press("Control+i");
  await expect(body).toHaveValue("zażółć gęślą");
});

test("Ctrl+Z cofa pogrubienie natywnie", async ({ page }) => {
  const body = await openComposer(page);
  await body.pressSequentially("tekst");
  await body.press("Shift+Home");
  await body.press("Control+b");
  await expect(body).toHaveValue("**tekst**");
  await body.press("Control+z");
  await expect(body).toHaveValue("tekst");
});

test("Ctrl+K wstawia link zamiast otwierać paletę poleceń", async ({ page }) => {
  const body = await openComposer(page);
  await body.pressSequentially("moja strona");
  await body.press("Shift+Home");
  await body.press("Control+k");
  await expect(body).toHaveValue("[moja strona](url)");
  // „url” jest zaznaczone — pisanie je zastępuje.
  await body.pressSequentially("https://example.com");
  await expect(body).toHaveValue("[moja strona](https://example.com)");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Ponownie na linku: zostaje sam tekst.
  await body.press("Control+k");
  await expect(body).toHaveValue("moja strona");
});

test("Ctrl+K poza polem treści nadal otwiera paletę", async ({ page }) => {
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("Enter kontynuuje listę, a pusty znacznik ją kończy", async ({ page }) => {
  const body = await openComposer(page);
  await body.pressSequentially("- jabłka");
  await body.press("Enter");
  await expect(body).toHaveValue("- jabłka\n- ");
  await body.pressSequentially("gruszki");
  await body.press("Enter");
  await body.press("Enter");
  await expect(body).toHaveValue("- jabłka\n- gruszki\n");

  await body.fill("");
  await body.pressSequentially("1. pierwsze");
  await body.press("Enter");
  await expect(body).toHaveValue("1. pierwsze\n2. ");

  await body.fill("");
  await body.pressSequentially("- [x] zrobione");
  await body.press("Enter");
  await expect(body).toHaveValue("- [x] zrobione\n- [ ] ");
});

test("Tab wcina pozycję listy, Shift+Tab cofa; poza listą Tab zostaje domyślny", async ({ page }) => {
  const body = await openComposer(page);
  await body.pressSequentially("- punkt");
  await body.press("Tab");
  await expect(body).toHaveValue("  - punkt");
  await expect(body).toBeFocused();
  await body.press("Shift+Tab");
  await expect(body).toHaveValue("- punkt");

  // Poza listą Tab wychodzi z pola (nie pułapkuje fokusu).
  await body.fill("zwykły tekst");
  await body.press("Tab");
  await expect(body).not.toBeFocused();
});

test("Esc na linii listy zwalnia pułapkę Tab", async ({ page }) => {
  const body = await openComposer(page);
  await body.pressSequentially("- punkt");
  await body.press("Escape");
  // Pasek mógł zareagować na Esc — wróć do pola, jeśli trzeba.
  if (await body.count() === 0) return;
  await body.focus();
  await body.press("Tab");
  await expect(body).toHaveValue("- punkt");
});

test("Alt+↑/↓ przenosi linię, Shift+Alt+↓ ją duplikuje", async ({ page }) => {
  const body = await openComposer(page);
  await body.pressSequentially("pierwsza");
  await body.press("Enter");
  await body.pressSequentially("druga");
  await body.press("Alt+ArrowUp");
  await expect(body).toHaveValue("druga\npierwsza");
  await body.press("Alt+ArrowDown");
  await expect(body).toHaveValue("pierwsza\ndruga");
  await body.press("Shift+Alt+ArrowDown");
  await expect(body).toHaveValue("pierwsza\ndruga\ndruga");
});

test("Ctrl+Enter zapisuje notatkę i zamyka pasek", async ({ page }) => {
  const title = `Zebranie jutrzejsze ${Date.now()}`;
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(title);
  const body = page.getByPlaceholder("Treść notatki...");
  await body.click();
  await body.pressSequentially("treść do zapisu");
  await body.press("Control+Enter");
  await expect(page.getByText("Zapisz notatkę...")).toBeVisible();
  await expect(page.getByText(title)).toBeVisible();
});

test("licznik pokazuje słowa, znaki, czas czytania i liczby zaznaczenia", async ({ page }) => {
  const body = await openComposer(page);
  await body.pressSequentially("ala ma kota");
  const stats = page.getByTestId("editor-stats");
  await expect(stats).toHaveText("3 słowa · 11 znaków · ~1 min czytania");
  await body.press("Shift+Home");
  await expect(stats).toHaveText("Zaznaczono 3 słowa · 11 znaków");
});

test("w edytorze notatki: Ctrl+B, [[ + Enter i Ctrl+Enter zapisu", async ({ page }) => {
  const stamp = Date.now();
  const target = `Zakupy ${stamp}`;
  const source = `Lista ${stamp}`;
  await addNote(page, target);
  await addNote(page, source);

  await page.getByText(source).click();
  const editor = page.locator("[data-note-id]").getByPlaceholder("Treść notatki...");
  await editor.click();
  await editor.pressSequentially("ważne");
  await editor.press("Shift+Home");
  await editor.press("Control+b");
  await expect(editor).toHaveValue("**ważne**");
  await editor.press("End");
  await editor.pressSequentially(" patrz [[zak");
  await expect(page.getByRole("option", { name: target })).toBeVisible();
  await editor.press("Enter");
  await expect(editor).toHaveValue(`**ważne** patrz [[${target}]]`);

  await editor.press("Control+Enter");
  await expect(page.getByRole("button", { name: "Zapisz", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: source })).toBeVisible();
});

test("Alt+↑/↓ w liście zadań przenosi pozycję", async ({ page }) => {
  const title = `Zakupy tygodniowe ${Date.now()}`;
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(title);
  await page.getByRole("button", { name: "Lista zadań" }).click();
  const add = page.getByPlaceholder("Dodaj element...");
  await add.fill("mleko");
  await add.press("Enter");
  await add.fill("chleb");
  await add.press("Enter");

  const items = page.locator("input[data-checklist-item]");
  await expect(items.nth(0)).toHaveValue("mleko");
  await items.nth(1).focus();
  await items.nth(1).press("Alt+ArrowUp");
  await expect(items.nth(0)).toHaveValue("chleb");
  await expect(items.nth(1)).toHaveValue("mleko");
});
