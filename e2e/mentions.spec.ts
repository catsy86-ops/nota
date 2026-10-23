import { test, expect, type Page } from "@playwright/test";
import { editorBody, expectEditorText } from "./helpers/editor";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

async function addNote(page: Page, title: string) {
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(title);
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(page.getByText("Zapisz notatkę...")).toBeVisible();
  await expect(page.getByText(title)).toBeVisible();
}

test("@ podpowiada daty i notatki, wstawia [[link]] albo datę", async ({ page }) => {
  const stamp = Date.now();
  const target = `Wzmianka ${stamp}`;
  const source = `Zródło ${stamp}`;
  await addNote(page, target);
  await addNote(page, source);

  await page.getByText(source).click();
  const editor = editorBody(page.locator("[data-note-id]"));
  await editor.click();

  await editor.pressSequentially("Zob. @wzm");
  await expect(page.getByRole("listbox", { name: "Wzmianki: daty i notatki" })).toBeVisible();
  await editor.press("Enter");
  await expectEditorText(editor, `Zob. [[${target}]]`);

  await editor.pressSequentially(" na @ju");
  await expect(page.getByRole("option", { name: /Jutro/ })).toBeVisible();
  await editor.press("Enter");
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const long = tomorrow.toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" });
  await expectEditorText(editor, `Zob. [[${target}]] na ${long}`);

  // adres e-mail nie otwiera listy
  await editor.pressSequentially(" jan@firma");
  await expect(page.getByRole("listbox")).toHaveCount(0);
});
