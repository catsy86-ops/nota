import { test, expect, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

async function addNote(page: Page, title: string) {
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(title);
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  // Rozwinięty pasek wygasa z animacją, wciąż z polem „Tytuł” i starym tytułem —
  // bez czekania następne `getByPlaceholder("Tytuł")` trafia czasem na dwa pola.
  await expect(page.getByText("Zapisz notatkę...")).toBeVisible();
  await expect(page.getByText(title)).toBeVisible();
}

test("widok jest w adresie: odświeżenie go zachowuje, a „wstecz” wraca @smoke", async ({ page }) => {
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

test("skrót PWA /?new=1 otwiera nową notatkę i czyści parametr z adresu", async ({ page }) => {
  await page.goto("/?new=1");
  await expect(page.getByPlaceholder("Tytuł")).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  expect(new URL(page.url()).search).toBe("");
});

test("udostępnienie /share tworzy notatkę, pokazuje toast i wraca do Notatek", async ({ page }) => {
  await page.goto("/share?title=Zebranie%20jutrzejsze&text=Agenda%20spotkania&url=https%3A%2F%2Fexample.com%2Fa");
  await expect(page.getByText("Zapisano w NOTKACH")).toBeVisible();
  await expect(page.getByRole("button", { name: "Otwórz" })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  expect(new URL(page.url()).search).toBe("");
  await expect(page.locator("[data-note-id]").filter({ hasText: "Zebranie jutrzejsze" })).toHaveCount(1);

  // Odświeżenie adresu udostępnienia w tej samej sesji nie dubluje notatki.
  await page.goto("/share?title=Zebranie%20jutrzejsze&text=Agenda%20spotkania&url=https%3A%2F%2Fexample.com%2Fa");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("[data-note-id]").filter({ hasText: "Zebranie jutrzejsze" })).toHaveCount(1);
});

test("skróty PWA do widoków otwierają Dziś, Grafik i Przypomnienia", async ({ page }) => {
  await page.goto("/dzis");
  await expect(page.getByRole("heading", { name: "Dziś", level: 1 })).toBeVisible();
  await page.goto("/grafik");
  await expect(page.getByRole("heading", { name: "Grafik" })).toBeVisible();
  await page.goto("/przypomnienia");
  await expect(page.getByRole("heading", { name: "Przypomnienia", level: 1 })).toBeVisible();
});
