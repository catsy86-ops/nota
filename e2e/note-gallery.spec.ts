import { test, expect } from "@playwright/test";

const NOW = new Date(2026, 9, 14, 12, 0).getTime();
// Jeden piksel PNG: adres `data:` jest poprawną „referencją” obrazu notatki.
const PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const note = (id: string, title: string, extra: Record<string, unknown> = {}) => ({
  id, title, content: "", color: "default", pinned: false, archived: false, trashed: false, trashedAt: null,
  labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null, order: 0,
  createdAt: NOW - 1000, updatedAt: NOW - 1000, ...extra,
});

test("galeria: okładka z pierwszego obrazu, tytuł i pola; kliknięcie otwiera czytnik (6.3)", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(([notes, px]) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy-notes-data", JSON.stringify(notes));
    localStorage.setItem("kaczy.viewPrefs.v1", JSON.stringify({ layout: "gallery" }));
    void px;
  }, [[note("g-a", "Łazienka u Kowalskich", { images: [PIXEL] }), note("g-b", "Bez zdjęcia")], PIXEL] as const);
  await page.goto("/");

  const gallery = page.locator("[data-note-gallery]");
  await expect(gallery).toBeVisible();
  const withCover = gallery.locator("[data-note-card-gallery='g-a']");
  await expect(withCover).toContainText("Łazienka u Kowalskich");
  await expect(withCover.locator("img")).toHaveCount(1);
  // Bez zdjęcia karta nie ma <img>, tylko zastępczą okładkę.
  await expect(gallery.locator("[data-note-card-gallery='g-b'] img")).toHaveCount(0);

  await withCover.click();
  await expect(page.getByRole("dialog", { name: "Łazienka u Kowalskich" })).toBeVisible();
});

test("galeria: układ da się wybrać w menu układów i zostaje po odświeżeniu", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript((notes) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy-notes-data", JSON.stringify(notes));
  }, [note("g-a", "Alfa"), note("g-b", "Beta")]);
  await page.goto("/");
  await page.getByRole("button", { name: "Widok i kolumny" }).click();
  await page.getByRole("menuitemradio", { name: "Galeria" }).click();
  await expect(page.locator("[data-note-gallery]")).toBeVisible();
  await page.reload();
  await expect(page.locator("[data-note-gallery]")).toBeVisible();
});
