import { test, expect, type Page } from "@playwright/test";

const NOW = new Date(2026, 9, 14, 12, 0).getTime();

const note = (id: string, title: string, extra: Record<string, unknown> = {}) => ({
  id, title, content: "", color: "default", pinned: false, archived: false, trashed: false, trashedAt: null,
  labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null, order: 0,
  createdAt: NOW - 1000, updatedAt: NOW - 1000, ...extra,
});

const NOTES = [note("n-a", "Alfa"), note("n-b", "Beta")];

/** Bez stanu z poprzednich testów: nowy kontekst na każdy test, dane z backupu-szkicu. */
async function seed(page: Page) {
  await page.clock.setFixedTime(NOW);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript((n) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy-notes-data", JSON.stringify(n));
    localStorage.setItem("kaczy.viewPrefs.v1", JSON.stringify({ layout: "table" }));
  }, NOTES);
  await page.goto("/");
  await expect(page.locator("[data-note-table]")).toBeVisible();
}

test("właściwości: dodanie pola, wpis wartości w tabeli i zachowanie po odświeżeniu", async ({ page }) => {
  await seed(page);

  await page.getByRole("button", { name: /^Pola/ }).click();
  await page.getByLabel("Nazwa nowego pola").fill("Klient");
  await page.getByRole("button", { name: "Dodaj pole" }).click();
  await expect(page.getByLabel("Nazwa pola Klient")).toHaveValue("Klient");
  await page.keyboard.press("Escape");

  // Nagłówek nowej kolumny i pole w wierszu „Alfa”.
  await expect(page.locator("[data-note-table] thead th", { hasText: "Klient" })).toHaveCount(1);
  const cell = page.getByLabel("Klient: Alfa");
  await cell.fill("Jan Kowalski");
  await cell.blur();

  // Kliknięcie w komórkę nie otwiera notatki.
  await expect(page.locator("[data-note-table] tbody tr").first()).toBeVisible();
  await expect(page.getByLabel("Klient: Alfa")).toHaveValue("Jan Kowalski");

  await page.reload();
  await expect(page.locator("[data-note-table]")).toBeVisible();
  await expect(page.getByLabel("Klient: Alfa")).toHaveValue("Jan Kowalski");
  await expect(page.getByLabel("Klient: Beta")).toHaveValue("");
});

test("właściwości: liczba z literą nie zapisuje się, a wybór ogranicza się do opcji", async ({ page }) => {
  await seed(page);

  await page.getByRole("button", { name: /^Pola/ }).click();
  await page.getByLabel("Nazwa nowego pola").fill("Kwota");
  await page.getByLabel("Typ nowego pola").selectOption("number");
  await page.getByRole("button", { name: "Dodaj pole" }).click();
  await page.getByLabel("Nazwa nowego pola").fill("Status");
  await page.getByLabel("Typ nowego pola").selectOption("select");
  await page.getByLabel("Opcje nowego pola").fill("Nowe, Gotowe");
  await page.getByRole("button", { name: "Dodaj pole" }).click();
  await page.keyboard.press("Escape");

  const amount = page.getByLabel("Kwota: Alfa");
  await amount.fill("12zł");
  await amount.blur();
  await expect(amount).toHaveValue("");

  await amount.fill("12,5");
  await amount.blur();
  await expect(page.getByLabel("Kwota: Alfa")).toHaveValue("12,5");

  const status = page.getByLabel("Status: Alfa");
  await status.selectOption("Gotowe");
  await expect(status).toHaveValue("Gotowe");
});

test("właściwości: usunięcie pola wymaga potwierdzenia i znika z tabeli", async ({ page }) => {
  await seed(page);

  await page.getByRole("button", { name: /^Pola/ }).click();
  await page.getByLabel("Nazwa nowego pola").fill("Adres");
  await page.getByRole("button", { name: "Dodaj pole" }).click();
  await page.getByRole("button", { name: "Usuń pole Adres" }).click();
  await expect(page.getByText("Usunąć pole „Adres” i jego wartości we wszystkich notatkach?")).toBeVisible();
  await page.getByRole("button", { name: "Usuń", exact: true }).click();
  await expect(page.getByText("Nie ma jeszcze żadnych pól.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-note-table] thead th", { hasText: "Adres" })).toHaveCount(0);
});
