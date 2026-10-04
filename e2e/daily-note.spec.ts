import { test, expect, type Page } from "@playwright/test";

// Stała data: tytuł notatki dnia i znacznik godziny nie zależą od dnia uruchomienia.
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 8, 28, 12, 0));
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

// Szablony (z „Notatką dnia”) są w rozwiniętym composerze.
async function openDailyNote(page: Page) {
  await page.getByRole("button", { name: "Zapisz notatkę..." }).click();
  await page.getByRole("button", { name: "Notatka dnia" }).click();
}

test("notatka dnia powstaje raz, a kolejne otwarcie dopisuje godzinę", async ({ page }) => {
  const title = "poniedziałek, 28 września";
  const cards = page.locator("[data-note-id]").filter({ hasText: title });

  await openDailyNote(page);
  // Otwiera się od razu w edytorze, z szablonem dziennika.
  const editor = page.locator("[data-note-id] textarea").first();
  await expect(editor).toHaveValue(/dziękuję/);

  await page.reload();
  await expect(cards).toHaveCount(1);

  await openDailyNote(page);
  await expect(editor).toHaveValue(/\*\*12:00\*\* $/);

  await page.reload();
  await expect(cards).toHaveCount(1); // bez duplikatu z tym samym tytułem
});
