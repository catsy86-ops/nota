import { test, expect, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

async function addNote(page: Page, title: string) {
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(title);
  await page.getByRole("button", { name: "Zamknij" }).click();
  await expect(page.getByText(title)).toBeVisible();
}

test("widok jest w adresie: odświeżenie go zachowuje, a „wstecz” wraca", async ({ page }) => {
  await page.getByRole("button", { name: "Archiwum" }).first().click();
  await expect(page).toHaveURL(/\/archiwum$/);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Archiwum", level: 1 })).toBeVisible();

  await page.getByRole("button", { name: "Kosz" }).first().click();
  await expect(page).toHaveURL(/\/kosz$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/archiwum$/);
  await expect(page.getByRole("heading", { name: "Archiwum", level: 1 })).toBeVisible();
});

test("notatka utworzona w folderze trafia do tego folderu", async ({ page }) => {
  const folder = `F${Date.now() % 100000}`;
  const title = `W folderze ${Date.now()}`;
  await page.getByRole("button", { name: "Nowy folder" }).click();
  await page.getByPlaceholder("Nazwa...").fill(folder);
  await page.getByPlaceholder("Nazwa...").press("Enter");
  await page.getByText(folder, { exact: true }).first().click();
  await expect(page).toHaveURL(/\/folder\//);
  await expect(page.getByText(`trafi do: ${folder}`)).toBeVisible();

  await addNote(page, title);
  await page.reload();
  await expect(page.getByText(title)).toBeVisible(); // nadal w tym folderze po odświeżeniu
});

test("link /notatka/:id otwiera notatkę, także z Archiwum", async ({ page }) => {
  const title = `Link ${Date.now()}`;
  await addNote(page, title);
  const id = await page.locator("[data-note-id]").filter({ hasText: title }).getAttribute("data-note-id");

  await page.goto(`/notatka/${id}`);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(`[data-note-id="${id}"]`)).toBeVisible();

  await page.goto("/notatka/nie-ma-takiej");
  await expect(page.getByText("Tej notatki już nie ma")).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});
