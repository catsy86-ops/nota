import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("adds a new note", async ({ page }) => {
  const title = `E2E ${Date.now()}`;
  await page.getByPlaceholder(/tytuł|title/i).first().fill(title);
  await page.keyboard.press("Enter");
  await expect(page.getByText(title)).toBeVisible();
});

test("edits an existing note", async ({ page }) => {
  const title = `E2E-edit ${Date.now()}`;
  await page.getByPlaceholder(/tytuł|title/i).first().fill(title);
  await page.keyboard.press("Enter");

  const note = page.getByText(title);
  await expect(note).toBeVisible();
  await note.click();

  const newTitle = `${title}-zmieniona`;
  const titleField = page.getByDisplayValue(title);
  await titleField.fill(newTitle);
  await page.keyboard.press("Escape");

  await expect(page.getByText(newTitle)).toBeVisible();
});

test("moves a note to trash and it disappears from the main list", async ({ page }) => {
  const title = `E2E-trash ${Date.now()}`;
  await page.getByPlaceholder(/tytuł|title/i).first().fill(title);
  await page.keyboard.press("Enter");

  const note = page.locator(`[data-note-id]`).filter({ hasText: title });
  await expect(note).toBeVisible();
  await note.hover();
  await note.getByTitle(/usuń/i).click();
  await page.getByRole("button", { name: /usuń|potwierdź/i }).last().click();

  await expect(page.getByText(title)).not.toBeVisible();
});
