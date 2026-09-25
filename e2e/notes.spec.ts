import { test, expect, type Page } from "@playwright/test";

// Skip the first-run onboarding tour so it doesn't overlay the page and eat clicks.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

/** AddNoteBar starts collapsed to a single "Zapisz notatkę..." pill — expand it first. */
async function addNote(page: Page, title: string) {
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(title);
  await page.getByRole("button", { name: "Zamknij" }).click();
}

test("adds a new note", async ({ page }) => {
  const title = `E2E ${Date.now()}`;
  await addNote(page, title);
  await expect(page.getByText(title)).toBeVisible();
});

test("edits an existing note", async ({ page }) => {
  const title = `E2E-edit ${Date.now()}`;
  await addNote(page, title);

  const note = page.getByText(title);
  await expect(note).toBeVisible();
  await note.click();

  const newTitle = `${title}-zmieniona`;
  const titleField = page.getByPlaceholder("Tytuł");
  await expect(titleField).toHaveValue(title);
  await titleField.fill(newTitle);
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();

  await expect(page.getByText(newTitle)).toBeVisible();
});

test("moves a note to trash and it disappears from the main list", async ({ page }) => {
  const title = `E2E-trash ${Date.now()}`;
  await addNote(page, title);

  const note = page.locator(`[data-note-id]`).filter({ hasText: title });
  await expect(note).toBeVisible();
  await note.hover();
  await note.getByLabel(/usuń/i).click();
  await page.getByRole("button", { name: "Przenieś do kosza" }).click();

  // Scoped to note cards, not the "Przeniesiono do kosza" undo toast (which
  // also contains the note title).
  await expect(page.locator("[data-note-id]").filter({ hasText: title })).not.toBeVisible();
});
