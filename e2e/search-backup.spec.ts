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

test("wyszukiwanie pokazuje trafienia z Archiwum i przechodzi do nich", async ({ page }) => {
  const title = `Faktura ${Date.now()}`;
  await addNote(page, title);
  const card = page.locator("[data-note-id]").filter({ hasText: title });
  await card.hover();
  await card.getByRole("button", { name: "Archiwizuj" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Archiwizuj" }).click();
  await expect(card).toHaveCount(0);

  await page.getByRole("searchbox").first().fill(title);
  await expect(page.getByText("Brak wyników w Notatkach")).toBeVisible();
  await page.getByRole("button", { name: "1 w Archiwum" }).click();
  await expect(page).toHaveURL(/\/archiwum\?q=/);
  await expect(card).toBeVisible();
});

test("pełny backup przywraca się z wyborem sekcji", async ({ page }) => {
  const title = `Backup ${Date.now()}`;
  await addNote(page, title);
  await page.getByRole("button", { name: "Ustawienia" }).first().click();
  await page.getByRole("tab", { name: "Dane" }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Pobierz pełny backup teraz" }).click(),
  ]);
  const file = (await download.path())!;

  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: "Przywróć z pliku backupu" }).click(),
  ]);
  await chooser.setFiles(file);
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByText("Przywrócić ten backup?")).toBeVisible();
  await expect(dialog.getByText(/Historia wersji/)).toBeVisible();
  await expect(dialog.getByText("Odznaki i passa")).toBeVisible();
  await dialog.getByRole("button", { name: "Przywróć backup" }).click();
  await expect(page.getByText(/Backup przywrócony/)).toBeVisible();
  await page.waitForLoadState("load");
  await expect(page.getByText(title)).toBeVisible();
});
