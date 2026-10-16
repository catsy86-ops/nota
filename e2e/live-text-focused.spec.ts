import { test, expect, type Page } from "@playwright/test";

const CONTENT = "Treść notatki...";

async function open(page: Page) {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
}

async function dataTab(page: Page) {
  const settings = page.getByRole("button", { name: "Ustawienia" }).first();
  // Escape zamykający poprzedni dialog potrafi też zwinąć panel boczny.
  if (!(await settings.isVisible())) await page.getByRole("button", { name: /panel/i }).first().click();
  await settings.click();
  await page.getByRole("tab", { name: "Dane" }).click();
}

async function exportSync(page: Page): Promise<string> {
  await dataTab(page);
  const [d] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Zapisz plik synchronizacji" }).click()]);
  await page.keyboard.press("Escape");
  return (await d.path())!;
}

async function mergeSync(page: Page, file: string) {
  await dataTab(page);
  // Toast z poprzedniego scalenia może jeszcze wisieć — niech zniknie, żeby niżej widzieć tylko nowy.
  const toasts = page.getByText(/^Scalono/);
  await expect(toasts).toHaveCount(0, { timeout: 15_000 });
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("button", { name: "Scal z pliku" }).click()]);
  await chooser.setFiles(file);
  // Scalenie pod obciążeniem równoległych testów bywa wolniejsze niż domyślne 5 s.
  await expect(toasts).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press("Escape");
}

test("tekst peera wpada do sfokusowanego edytora bez blur, a karetka zostaje przy swoim znaku", async ({ browser }) => {
  const title = `Na żywo ${Date.now()}`;
  const a = await (await browser.newContext()).newPage();
  await open(a);
  await a.getByText("Zapisz notatkę...").click();
  await a.getByPlaceholder("Tytuł").fill(title);
  await a.getByPlaceholder("Treść notatki...").fill("środek");
  await a.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(a.getByText(title)).toBeVisible();

  const b = await (await browser.newContext()).newPage();
  await open(b);
  await mergeSync(b, await exportSync(a));

  // A dopisuje początek i zapisuje.
  await a.getByText(title).click();
  await a.getByPlaceholder(CONTENT).fill("POCZĄTEK środek");
  await a.getByRole("button", { name: "Zapisz", exact: true }).click();
  const fileA = await exportSync(a);

  // B pisze w otwartym, sfokusowanym edytorze i NIE wychodzi z pola.
  await b.getByText(title).click();
  const editor = b.getByPlaceholder(CONTENT);
  await editor.click();
  await editor.press("End");
  await editor.pressSequentially(" KONIEC");
  await expect(editor).toHaveValue("środek KONIEC");
  await expect(editor).toBeFocused();

  // Scalenie z pliku A przychodzi, gdy pole ma fokus.
  await mergeSync(b, fileA);
  await expect(editor).toHaveValue("POCZĄTEK środek KONIEC", { timeout: 10_000 });
  // Karetka wciąż stoi za własnym tekstem („KONIEC”), a nie na początku pola.
  const caret = await editor.evaluate((el: HTMLTextAreaElement) => el.selectionStart);
  expect(caret).toBe("POCZĄTEK środek KONIEC".length);
});
