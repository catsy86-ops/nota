import { test, expect, type Page } from "@playwright/test";

// Plan Notatek 6.4: blok ```zapytanie w czytniku — wyniki wg składni wyszukiwarki, kolumny z pól, edycja w miejscu.

const NOW = new Date(2026, 9, 14, 12, 0).getTime();

const note = (id: string, title: string, extra: Record<string, unknown> = {}) => ({
  id, title, content: "", color: "default", pinned: false, archived: false, trashed: false, trashedAt: null,
  labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null, order: 0,
  createdAt: NOW - 1000, updatedAt: NOW - 1000, ...extra,
});

const NOTES = [
  note("host", "Przegląd budów", { content: "Moje budowy:\n\n```zapytanie\netykieta:budowa kolumny:Klient sortuj:tytul\n```\n", updatedAt: NOW - 5000 }),
  note("n-a", "Łazienka", { labels: ["budowa"] }),
  note("n-b", "Kuchnia", { labels: ["budowa"] }),
  note("n-c", "Ogród", { labels: ["dom"] }),
];

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

test("blok zapytania w czytniku: wyniki z etykiety, kolumna pola i zmiana wartości w miejscu (6.4)", async ({ page }) => {
  await seed(page);

  await page.getByRole("button", { name: /^Pola/ }).click();
  await page.getByLabel("Nazwa nowego pola").fill("Klient");
  await page.getByRole("button", { name: "Dodaj pole" }).click();
  await page.keyboard.press("Escape");

  await page.locator("[data-note-row='host']").click();
  const reader = page.getByRole("dialog", { name: "Przegląd budów" });
  const block = reader.locator("[data-query-block]");
  await expect(block).toBeVisible();
  // Tylko notatki z etykietą „budowa”, wg tytułu; sama notatka z blokiem i „Ogród” nie wchodzą.
  await expect(block.locator("[data-query-row]")).toHaveCount(2);
  await expect(block.locator("[data-query-row]").first()).toContainText("Kuchnia");
  await expect(block.locator("th", { hasText: "Klient" })).toBeVisible();

  // Zmiana wartości w bloku zapisuje się w notatce.
  const cell = block.getByLabel("Klient: Kuchnia");
  await cell.fill("Nowak");
  await cell.blur();
  await expect(block.getByLabel("Klient: Kuchnia")).toHaveValue("Nowak");

  // Ta sama wartość jest w tabeli notatek pod czytnikiem.
  await expect(page.locator("[data-note-row='n-b']").getByLabel("Klient: Kuchnia")).toHaveValue("Nowak");
});
