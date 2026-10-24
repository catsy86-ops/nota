import { test, expect, type Page } from "@playwright/test";
import { editorBody, expectEditorText } from "./helpers/editor";

// Wyodrębnij zaznaczenie: fragment przechodzi do nowej notatki, a w bieżącej zostaje [[tytuł]].
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

async function addNote(page: Page, title: string, content: string) {
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(title);
  await page.getByPlaceholder("Treść notatki...").fill(content);
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(page.getByText("Zapisz notatkę...")).toBeVisible();
}

test("zaznaczenie wyodrębnia się do nowej notatki, a w bieżącej zostaje link", async ({ page }) => {
  const stamp = Date.now();
  const source = `Źródło ${stamp}`;
  await addNote(page, source, "Alfa beta gamma delta");

  const card = page.getByRole("article", { name: source });
  await page.getByText(source).click();
  const body = editorBody(page);
  await body.click();
  // „Alfa ” to 5 znaków, „beta gamma” to 10 — zaznaczamy środek.
  await page.keyboard.press("Control+Home");
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
  for (let i = 0; i < 10; i++) await page.keyboard.press("Shift+ArrowRight");

  await page.getByRole("button", { name: "Wyodrębnij zaznaczenie do nowej notatki" }).click();

  const extracted = page.getByRole("article", { name: "beta gamma" });
  await expect(extracted).toHaveCount(1);
  await expect(page.getByText("Wyodrębniono do notatki „beta gamma”")).toBeVisible();

  await expectEditorText(body, "Alfa [[beta gamma]] delta");
  await card.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(card).toContainText("Alfa [[beta gamma]] delta");
});

test("bez zaznaczenia nic się nie tworzy, tylko podpowiedź", async ({ page }) => {
  const source = `Bez zaznaczenia ${Date.now()}`;
  await addNote(page, source, "Tekst bez zaznaczenia");

  await page.getByText(source).click();
  const body = editorBody(page);
  await body.click();
  await page.keyboard.press("Control+Home");

  await page.getByRole("button", { name: "Wyodrębnij zaznaczenie do nowej notatki" }).click();
  await expect(page.getByText("Zaznacz tekst, który chcesz wyodrębnić")).toBeVisible();
  await expectEditorText(body, "Tekst bez zaznaczenia");
});
