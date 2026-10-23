import { test, expect, type Page } from "@playwright/test";

// Aliasy notatek (Faza 3.1): alias z menu notatki działa jako cel [[linku]],
// a [[cel|tekst]] pokazuje tekst zamiast celu.
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
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
}

async function openNewestInReader(page: Page, title: string) {
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Home");
  await page.keyboard.press(" ");
  const reader = page.getByRole("dialog", { name: title });
  await expect(reader).toBeVisible();
  return reader;
}

test("alias z menu notatki otwiera ją z [[linku]]; [[cel|tekst]] pokazuje tekst", async ({ page }) => {
  const stamp = Date.now();
  const target = `Projekt ${stamp}`;
  const source = `Źródło ${stamp}`;
  await addNote(page, target, "Treść celu");

  // Alias w menu notatki (popover z polem; Enter zapisuje).
  // Aliasy są w „Więcej opcji” kafla, nie na pasku od razu.
  await page.getByRole("heading", { name: target }).hover();
  await page.getByRole("button", { name: "Więcej opcji" }).first().click();
  await page.getByRole("button", { name: "Aliasy" }).first().click();
  await page.locator("#alias-input").fill(`PL${stamp}, łazienka`);
  await page.locator("#alias-input").press("Enter");

  await addNote(page, source, `Zobacz [[PL${stamp}]] oraz [[łazienka|łazienkę]]`);
  const reader = await openNewestInReader(page, source);
  await expect(reader.getByRole("button", { name: `PL${stamp}` })).toBeVisible();
  await expect(reader.getByRole("button", { name: "łazienkę" })).toBeVisible();

  // Klik w alias otwiera notatkę docelową.
  await reader.getByRole("button", { name: `PL${stamp}` }).click();
  await expect(page.getByRole("dialog", { name: target })).toBeVisible();
});
