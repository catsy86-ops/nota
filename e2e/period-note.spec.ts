import { test, expect, type Page } from "@playwright/test";

// Stała data (sobota 24 października 2026, tydzień ISO 43): tytuły nie zależą od dnia uruchomienia.
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 24, 12, 0));
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

// Szablony (z notatkami okresu) są w rozwiniętym composerze.
async function openPeriodNote(page: Page, chip: string) {
  await page.getByRole("button", { name: "Zapisz notatkę..." }).click();
  await page.getByRole("button", { name: chip }).click();
}

test("notatka tygodnia powstaje raz, a kolejne kliknięcie otwiera tę samą", async ({ page }) => {
  const cards = page.locator("[data-note-id]").filter({ hasText: "Tydzień 43 · 2026" });

  await openPeriodNote(page, "Notatka tygodnia");
  const editor = page.locator("[data-note-id]").getByPlaceholder("Treść notatki...");
  await expect(editor).toHaveValue(/Cele na ten tydzień/);

  await page.reload();
  await expect(cards).toHaveCount(1);

  await openPeriodNote(page, "Notatka tygodnia");
  await page.reload();
  await expect(cards).toHaveCount(1); // bez duplikatu z tym samym tytułem
});

test("notatka miesiąca ma osobny klucz od tygodniowej", async ({ page }) => {
  await openPeriodNote(page, "Notatka miesiąca");
  await expect(page.locator("[data-note-id]").filter({ hasText: "Październik 2026" })).toHaveCount(1);
  await expect(page.locator("[data-note-id]").filter({ hasText: "Tydzień 43" })).toHaveCount(0);
});
