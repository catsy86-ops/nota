import { test, expect, type Page } from "@playwright/test";

// Jeden czytnik: podgląd (Spacja) i prezentacja to dwa tryby tego samego widoku.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

async function addNote(page: Page, title: string, content: string) {
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(title);
  await page.getByPlaceholder("Zapisz notatkę (obsługuje **Markdown**)...").fill(content);
  await page.getByRole("button", { name: "Zamknij" }).click();
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
  await expect(page.locator("[data-note-id] textarea").first()).toHaveValue("Treść celu do przeczytania");
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
