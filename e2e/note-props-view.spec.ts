import { test, expect, type Page } from "@playwright/test";

// Pola notatek (4b) w widokach: sortowanie i filtr `pole:` na komputerze, wartości pod tytułem
// i czytnik z edycją na telefonie, sortowanie w arkuszu „Widok i kolumny”.

const NOW = new Date(2026, 9, 14, 12, 0).getTime();

const note = (id: string, title: string) => ({
  id, title, content: "", color: "default", pinned: false, archived: false, trashed: false, trashedAt: null,
  labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null, order: 0,
  createdAt: NOW - 1000, updatedAt: NOW - 1000,
});

const NOTES = [note("n-a", "Alfa"), note("n-b", "Beta"), note("n-c", "Gamma")];

async function seed(page: Page, width = 1440) {
  await page.clock.setFixedTime(NOW);
  await page.setViewportSize({ width, height: 1000 });
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

async function addNumberField(page: Page, name: string) {
  await page.getByRole("button", { name: /^Pola/ }).click();
  await page.getByLabel("Nazwa nowego pola").fill(name);
  await page.getByLabel("Typ nowego pola").selectOption("number");
  await page.getByRole("button", { name: "Dodaj pole" }).click();
  await page.keyboard.press("Escape");
}

async function setCell(page: Page, label: string, value: string) {
  const cell = page.getByLabel(label, { exact: true });
  await cell.fill(value);
  await cell.blur();
}

const rowOrder = (page: Page) =>
  page.locator("[data-note-row]").evaluateAll((els) => els.map((e) => e.getAttribute("data-note-row")));

test("pola: sortowanie po kolumnie (puste zawsze na końcu) i filtr pole: w wyszukiwarce", async ({ page }) => {
  await seed(page);
  await addNumberField(page, "Kwota");
  await setCell(page, "Kwota: Alfa", "12,5");
  await setCell(page, "Kwota: Beta", "3");
  // Gamma zostaje bez wartości.

  const header = page.locator("[data-note-table] thead").getByRole("button", { name: "Kwota" });
  await header.click();
  expect(await rowOrder(page)).toEqual(["n-b", "n-a", "n-c"]);
  await header.click();
  expect(await rowOrder(page)).toEqual(["n-a", "n-b", "n-c"]);

  await page.getByRole("searchbox").first().fill('pole:"Kwota=3"');
  await expect(page.locator("[data-note-row]")).toHaveCount(1);
  expect(await rowOrder(page)).toEqual(["n-b"]);
});

test("pola na telefonie: wartość pod tytułem, czytnik z edycją i sortowanie w arkuszu widoku", async ({ page }) => {
  await seed(page);
  await addNumberField(page, "Kwota");
  await setCell(page, "Kwota: Alfa", "12,5");
  await setCell(page, "Kwota: Beta", "3");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.locator("[data-note-table]")).toBeVisible();
  await expect(page.locator("[data-note-row='n-a']").getByText("Kwota: 12,5")).toBeVisible();

  // Czytnik pokazuje pola i pozwala je zmienić.
  await page.locator("[data-note-row='n-a']").click();
  const fields = page.getByRole("region", { name: "Pola notatki" });
  await expect(fields).toBeVisible();
  await fields.getByLabel("Kwota: Alfa", { exact: true }).fill("13");
  await fields.getByLabel("Kwota: Alfa", { exact: true }).blur();
  await expect(fields.getByLabel("Kwota: Alfa", { exact: true })).toHaveValue("13");
  // Escape w polu tylko cofa edycję, więc zamykamy czytnik przyciskiem.
  await page.getByRole("button", { name: "Zamknij" }).click();

  // Arkusz „Widok i kolumny” ma sortowanie po polu; wybrany kierunek rosnąco: Beta (3) przed Alfą (13).
  await page.getByRole("button", { name: "Widok i kolumny" }).click();
  await page.getByRole("combobox", { name: "Sortuj wg" }).selectOption({ label: "Kwota" });
  await page.getByRole("radio", { name: "Rosnąco" }).click();
  await expect.poll(() => rowOrder(page)).toEqual(["n-b", "n-a", "n-c"]);
});
