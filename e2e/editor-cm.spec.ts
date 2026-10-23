import { test, expect, type Locator, type Page } from "@playwright/test";

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
  return body.evaluate((el) => (el as HTMLElement).innerText.replace(/\n+$/, ""));
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
