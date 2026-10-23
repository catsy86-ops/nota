import { test, expect, type Locator, type Page } from "@playwright/test";
import { editorBody, readEditorText } from "./helpers/editor";

/**
 * Edytor CodeMirror 6 za flagą `cmEditor` (plan rozbudowy, Faza 1a).
 * Te same zachowania co w textarea: zapis, skróty, lista, podpowiedź `[[`.
 * Kompozytor (AddNoteBar) nadal jest textarea — testy otwierają istniejącą notatkę.
 */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.features.v1", JSON.stringify({ cmEditor: true }));
  });
  await page.goto("/");
});

async function addNote(page: Page, title: string) {
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(title);
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(page.getByText("Zapisz notatkę...")).toBeVisible();
}

/** Pole treści CM w edytorze notatki (contentDOM ma rolę textbox i etykietę). */
async function openEditor(page: Page, title: string): Promise<Locator> {
  await page.getByText(title).click();
  const body = page.getByRole("textbox", { name: "Treść notatki" });
  await expect(page.locator(".cm-editor")).toHaveCount(1);
  await body.click();
  return body;
}

/** Tekst z zachowaniem nowych linii (innerText kontentu CM). */
function cmText(body: Locator) {
  return readEditorText(body);
}

test("edycja w CM zapisuje treść po „Zapisz”", async ({ page }) => {
  const title = `CM-zapis ${Date.now()}`;
  await addNote(page, title);
  const body = await openEditor(page, title);
  await body.pressSequentially("akapit pisany w CodeMirror");
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(page.getByText("akapit pisany w CodeMirror")).toBeVisible();
});

test("Ctrl+B otacza zaznaczenie w CM, a Ctrl+Z cofa", async ({ page }) => {
  const title = `CM-bold ${Date.now()}`;
  await addNote(page, title);
  const body = await openEditor(page, title);
  await body.pressSequentially("tekst");
  await body.press("Shift+Home");
  await body.press("Control+b");
  await expect.poll(() => cmText(body)).toBe("**tekst**");
  await body.press("Control+z");
  await expect.poll(() => cmText(body)).toBe("tekst");
});

test("Enter kontynuuje listę w CM, a Tab wcina pozycję", async ({ page }) => {
  const title = `CM-lista ${Date.now()}`;
  await addNote(page, title);
  const body = await openEditor(page, title);
  await body.pressSequentially("- pierwsza");
  await body.press("Enter");
  await body.pressSequentially("druga");
  await expect.poll(() => cmText(body)).toBe("- pierwsza\n- druga");
  await body.press("Tab");
  await expect.poll(() => cmText(body)).toBe("- pierwsza\n  - druga");
});

test("[[ podpowiada tytuł i wstawia link w CM", async ({ page }) => {
  const target = `CM-cel ${Date.now()}`;
  const source = `CM-zrodlo ${Date.now()}`;
  await addNote(page, target);
  await addNote(page, source);
  const body = await openEditor(page, source);
  await body.pressSequentially("[[CM-cel");
  const list = page.getByRole("listbox", { name: "Podpowiedzi linków do notatek" });
  await expect(list.getByRole("option", { name: target })).toBeVisible();
  await body.press("Enter");
  await expect.poll(() => cmText(body)).toBe(`[[${target}]]`);
});

test("Ctrl+Z cofa formatowanie osobno od pisania (wiązanie z Yjs)", async ({ page }) => {
  const title = `CM-undo ${Date.now()}`;
  await addNote(page, title);
  const body = await openEditor(page, title);
  await body.pressSequentially("tekst");
  await body.press("Shift+Home");
  await body.press("Control+b");
  await expect.poll(() => cmText(body)).toBe("**tekst**");
  await body.press("Control+z");
  await expect.poll(() => cmText(body)).toBe("tekst");
  // Drugie cofnięcie cofa samo pisanie, a nie tylko część słowa.
  await body.press("Control+z");
  await expect.poll(() => cmText(body)).toBe("");
});

test("tekst trafia do notatki bez „Zapisz” (zapis przez dokument Yjs)", async ({ page }) => {
  const title = `CM-bez-zapisu ${Date.now()}`;
  await addNote(page, title);
  const body = await openEditor(page, title);
  await body.pressSequentially("nie kliknięto Zapisz");
  // Zamknięcie edycji klawiszem Esc, bez przycisku „Zapisz”.
  await body.press("Escape");
  // Yjs zapisuje każdą zmianę do IndexedDB; dajemy chwilę na flush przed przeładowaniem.
  await page.waitForTimeout(1500);
  await page.reload();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await page.getByRole("heading", { name: title, exact: true }).click();
  await expect.poll(() => readEditorText(editorBody(page))).toBe("nie kliknięto Zapisz");
});

test("pole zadania w CM odhacza zadanie w treści, a [[link]] poza kursorem traci nawiasy", async ({ page }) => {
  const title = `CM-podglad ${Date.now()}`;
  await addNote(page, title);
  const body = await openEditor(page, title);
  await body.fill("- [ ] kupić mleko\n\nZobacz [[Dom]]");
  // Kursor jest na ostatniej linii: pole zadania jest widoczne, a `[[` na tej linii — w całości.
  await expect(page.locator("input.cm-lp-task")).toHaveCount(1);
  await expect.poll(() => cmText(body)).toBe("- [ ] kupić mleko\n\nZobacz [[Dom]]");
  await page.locator("input.cm-lp-task").click();
  await expect.poll(() => cmText(body)).toBe("- [x] kupić mleko\n\nZobacz [[Dom]]");
  // Kursor na pierwszej linii: nawiasy `[[` i `]]` znikają, tekst „Dom” zostaje ze stylem wikilinku.
  await body.press("ArrowUp");
  await body.press("ArrowUp");
  await expect.poll(() => cmText(body)).toBe("- [x] kupić mleko\n\nZobacz Dom");
  await expect(page.locator(".cm-lp-wiki")).toHaveText("Dom");
  // Kursor wraca na linię z linkiem: nawiasy wracają do tekstu.
  await body.press("ArrowDown");
  await body.press("ArrowDown");
  await expect.poll(() => cmText(body)).toBe("- [x] kupić mleko\n\nZobacz [[Dom]]");
});

test("klik w [[link]] poza kursorem otwiera notatkę, a na linii z kursorem tylko ustawia kursor", async ({ page }) => {
  const target = `CM-klik-cel ${Date.now()}`;
  const source = `CM-klik-zrodlo ${Date.now()}`;
  await addNote(page, target);
  const targetBody = await openEditor(page, target);
  await targetBody.fill("TRESC-CELU-KLIK");
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await addNote(page, source);
  const body = await openEditor(page, source);
  await body.fill(`[[${target}]]\n\nkoniec`);
  // Kursor na ostatniej linii: link na pierwszej jest wyrenderowany, więc klik go otwiera.
  await expect(page.locator(".cm-lp-wiki")).toHaveText(target);
  await page.locator(".cm-lp-wiki").click();
  await expect(page.getByText("TRESC-CELU-KLIK")).toBeVisible();
});
