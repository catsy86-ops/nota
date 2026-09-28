import { test, expect, type Page } from "@playwright/test";

const CONTENT = "Treść (obsługuje **Markdown**)...";

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
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("button", { name: "Scal z pliku" }).click()]);
  await chooser.setFiles(file);
  await expect(page.getByText(/^Scalono/)).toBeVisible();
  await page.keyboard.press("Escape");
}

test("tekst z innego urządzenia pojawia się w otwartym edytorze bez utraty szkicu", async ({ browser }) => {
  const title = `Wspólna ${Date.now()}`;
  const a = await (await browser.newContext()).newPage();
  await open(a);
  await a.getByText("Zapisz notatkę...").click();
  await a.getByPlaceholder("Tytuł").fill(title);
  await a.getByPlaceholder("Zapisz notatkę (obsługuje **Markdown**)...").fill("środek");
  await a.getByRole("button", { name: "Zamknij" }).click();
  await expect(a.getByText(title)).toBeVisible();

  const b = await (await browser.newContext()).newPage();
  await open(b);
  await mergeSync(b, await exportSync(a));

  // A dopisuje początek i zapisuje.
  await a.getByText(title).click();
  await a.getByPlaceholder(CONTENT).fill("POCZĄTEK środek");
  await a.getByRole("button", { name: "Zapisz", exact: true }).click();
  const fileA = await exportSync(a);

  // B edytuje w kaflu, dopisuje koniec, i w trakcie scala plik z A.
  await b.getByText(title).click();
  const editor = b.getByPlaceholder(CONTENT);
  await editor.click();
  await editor.press("End");
  await editor.pressSequentially(" KONIEC");
  await expect(editor).toHaveValue("środek KONIEC");

  // Scalenie przez plik to też zmiana „zdalna” — ta sama ścieżka co WebRTC.
  await b.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await mergeSync(b, fileA);
  await expect(editor).toHaveValue("POCZĄTEK środek KONIEC");
});
