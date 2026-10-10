import { test, expect, type Page } from "@playwright/test";

const BODY = "Pierwsza linia\nDruga linia\n" + "x".repeat(1500);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

async function addNoteWithFile(page: Page, title: string) {
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(title);
  await page.getByTestId("attachment-input").setInputFiles({ name: "notatki.txt", mimeType: "text/plain", buffer: Buffer.from(BODY) });
  const row = page.getByTestId("attachment-row").filter({ hasText: "notatki.txt" });
  await expect(row).toBeVisible();
  await expect(row.getByTestId("attachment-size")).toHaveText("1,5 KB");
  await page.getByRole("button", { name: "Zamknij" }).click();
  // Rozwinięty pasek wygasa z animacją — czekamy, aż wróci zwinięty.
  await expect(page.getByText("Zapisz notatkę...")).toBeVisible();
}

const card = (page: Page, title: string) => page.locator("[data-note-id]").filter({ hasText: title });

test("załącznik: dodanie, znacznik na kaflu, przeładowanie, pobranie, usunięcie z cofnięciem", async ({ page }) => {
  const title = `Umowa najmu ${Date.now()}`;
  await addNoteWithFile(page, title);

  await expect(card(page, title).getByTestId("attachments-badge")).toHaveText("1");
  await page.reload();
  await expect(card(page, title).getByTestId("attachments-badge")).toHaveText("1");

  // Edycja w kaflu: lista załączników z akcjami.
  await card(page, title).getByRole("heading").click();
  const panel = card(page, title).getByTestId("attachments-panel");
  const row = panel.getByTestId("attachment-row");
  await expect(row).toHaveCount(1);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    panel.getByRole("button", { name: "Pobierz notatki.txt" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("notatki.txt");
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(c as Buffer);
  expect(Buffer.concat(chunks).toString()).toBe(BODY);

  await panel.getByRole("button", { name: "Usuń notatki.txt" }).click();
  await expect(row).toHaveCount(0);
  await page.getByRole("button", { name: "Cofnij" }).click();
  await expect(row).toHaveCount(1);

  // Drugi plik przez wybór pliku w kaflu.
  await panel.getByTestId("attachment-input").setInputFiles({ name: "umowa.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 test") });
  await expect(panel.getByTestId("attachment-row")).toHaveCount(2);
  await expect(panel.getByRole("button", { name: "Dodaj plik" })).toBeVisible();
});

test("załącznik: plik powyżej 10 MB jest odrzucony z komunikatem", async ({ page }) => {
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill("Duży plik");
  await page.getByTestId("attachment-input").setInputFiles({
    name: "ogromny.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(10 * 1024 * 1024 + 1, 1),
  });
  await expect(page.getByText(/Za duże \(max 10 MB na plik\)/)).toBeVisible();
  await expect(page.getByTestId("attachment-row")).toHaveCount(0);
});

test("załącznik: w czytniku jest lista i podgląd tekstu", async ({ page }) => {
  const title = `Raport kwartalny ${Date.now()}`;
  await addNoteWithFile(page, title);
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Home");
  await page.keyboard.press(" ");
  const reader = page.getByRole("dialog", { name: title });
  await expect(reader.getByTestId("attachment-row").filter({ hasText: "notatki.txt" })).toBeVisible();
  await reader.getByRole("button", { name: "Pokaż podgląd" }).click();
  await expect(reader.getByTestId("attachment-preview")).toContainText("Pierwsza linia");
});
