import { test, expect, type Page } from "@playwright/test";

// Jeden czytnik: podgląd (Spacja) i prezentacja to dwa tryby tego samego widoku.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

async function addNote(page: Page, title: string, content: string) {
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(title);
  await page.getByPlaceholder("Treść notatki...").fill(content);
  await page.getByRole("button", { name: "Zamknij" }).click();
  // Rozwinięty pasek wygasa z animacją, wciąż z polem „Tytuł” i starym tytułem —
  // bez czekania następne `getByPlaceholder("Tytuł")` trafia czasem na dwa pola.
  await expect(page.getByText("Zapisz notatkę...")).toBeVisible();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
}

test("podgląd → wikilink → pełny ekran → edycja w karcie", async ({ page }) => {
  const stamp = Date.now();
  const target = `Cel ${stamp}`;
  const source = `Źródło ${stamp}`;
  await addNote(page, target, "Treść celu do przeczytania");
  await addNote(page, source, `Zobacz [[${target}]]`);

  // Najnowsza notatka jest pierwsza: Home ją zaznacza, Spacja otwiera podgląd.
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Home");
  await page.keyboard.press(" ");
  const reader = page.getByRole("dialog", { name: source });
  await expect(reader).toHaveAttribute("data-reader-mode", "preview");

  // Wikilink przenosi czytanie do celu, a cel pokazuje, kto do niego linkuje.
  await reader.getByRole("button", { name: target }).click();
  const targetReader = page.getByRole("dialog", { name: target });
  await expect(targetReader).toContainText("Treść celu do przeczytania");
  await expect(targetReader.getByRole("button", { name: source })).toBeVisible();

  await targetReader.getByRole("button", { name: "Pełny ekran" }).click();
  await expect(targetReader).toHaveAttribute("data-reader-mode", "present");
  await page.keyboard.press("+");
  await expect(targetReader).toContainText("120%");

  await targetReader.getByRole("button", { name: /Edytuj/ }).click();
  await expect(page.getByRole("dialog", { name: target })).toHaveCount(0);
  await expect(page.locator("[data-note-id]").getByPlaceholder("Treść notatki...")).toHaveValue("Treść celu do przeczytania");
});

test("Esc zamyka prezentację", async ({ page }) => {
  const title = `Prezentacja ${Date.now()}`;
  await addNote(page, title, "Coś do pokazania");
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Home");
  await page.keyboard.press(" ");
  const reader = page.getByRole("dialog", { name: title });
  await reader.getByRole("button", { name: "Pełny ekran" }).click();
  await expect(reader).toHaveAttribute("data-reader-mode", "present");
  await page.keyboard.press("Escape");
  await expect(reader).toHaveCount(0);
});

test("czytnik kopiuje notatkę jako Markdown i pokazuje toast", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const title = `Kopia ${Date.now()}`;
  await addNote(page, title, "Treść do skopiowania");
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Home");
  await page.keyboard.press(" ");
  const reader = page.getByRole("dialog", { name: title });
  await reader.getByRole("button", { name: "Kopiuj jako Markdown" }).click();
  await expect(page.getByText("Skopiowano", { exact: true })).toBeVisible();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  // Schowek Windows oddaje końce linii jako CRLF.
  expect(clip.replace(/\r\n/g, "\n")).toBe(`# ${title}

Treść do skopiowania`);
});

test("paleta poleceń kopiuje notatkę z fokusem jako Markdown", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const title = `Paleta ${Date.now()}`;
  await addNote(page, title, "Treść z palety");
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Home");
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder(/Szukaj|Wpisz/).first().fill("Kopiuj notatkę jako Markdown");
  await page.getByRole("option", { name: /Kopiuj notatkę jako Markdown/ }).click();
  await expect(page.getByText("Skopiowano", { exact: true })).toBeVisible();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip.split("\r\n").join("\n")).toBe(`# ${title}\n\nTreść z palety`);
});

test("czytnik: spis treści z nagłówków przewija do wybranej sekcji", async ({ page }) => {
  const title = `Spis ${Date.now()}`;
  const filler = Array.from({ length: 40 }, (_, i) => `Linia ${i}`).join("\n\n");
  await addNote(page, title, `# Wstęp\n\n${filler}\n\n## Środek\n\n${filler}\n\n## Koniec\n\nostatnie słowa`);

  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Home");
  await page.keyboard.press(" ");
  const reader = page.getByRole("dialog", { name: title });
  const toc = reader.getByRole("navigation", { name: "Spis treści" });
  await expect(toc.getByRole("button")).toHaveCount(3);

  await toc.getByRole("button", { name: "Koniec" }).click();
  await expect(reader.getByRole("heading", { name: "Koniec" })).toBeInViewport();
});
