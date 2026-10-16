import { test, expect, type Page } from "@playwright/test";

// 1×1 px PNG.
const PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

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
}

const card = (page: Page, title: string) => page.locator("[data-note-id]").filter({ hasText: title });
const cardImage = (page: Page, title: string) => card(page, title).locator('img[src^="blob:"]');

/** Kafel z obrazkiem w edycji: „Dodaj obrazek” z paska kafla, potem zapis. */
test("obraz dodany w edycji kafla zostaje po przeładowaniu, a usunięcie ma Cofnij", async ({ page }) => {
  const title = `Kafel z obrazkiem ${Date.now()}`;
  await addNote(page, title);

  await page.getByText(title).click();
  // „Dodaj obrazek” siedzi w rozwijanym menu „Więcej opcji”, nie na pasku kafla.
  await card(page, title).getByRole("button", { name: "Więcej opcji" }).click();
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    card(page, title).getByRole("button", { name: "Dodaj obrazek" }).click(),
  ]);
  await chooser.setFiles({ name: "kropka.png", mimeType: "image/png", buffer: Buffer.from(PNG_B64, "base64") });
  await expect(cardImage(page, title)).toHaveCount(1);
  await card(page, title).getByRole("button", { name: "Zapisz", exact: true }).click();

  await page.reload();
  await expect(cardImage(page, title)).toHaveCount(1);

  // Usunięcie z edycji kafla: obrazek znika, a „Cofnij” w tościku go przywraca.
  await page.getByText(title).click();
  await card(page, title).getByRole("button", { name: "Usuń obrazek" }).click();
  await expect(page.getByText("Usunięto obrazek")).toBeVisible();
  await expect(cardImage(page, title)).toHaveCount(0);
  await page.getByRole("button", { name: "Cofnij", exact: true }).click();
  await expect(cardImage(page, title)).toHaveCount(1);
});
