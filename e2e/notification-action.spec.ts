import { test, expect, type Page } from "@playwright/test";

/** Notatka z przypomnieniem za godzinę, wpisana przed startem aplikacji. */
async function seedReminder(page: Page, title: string) {
  await page.addInitScript(({ title }) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    const now = Date.now();
    localStorage.setItem("kaczy-notes-data", JSON.stringify([{
      id: "r1", title, content: "", color: "default", pinned: false, archived: false, trashed: false,
      trashedAt: null, labels: [], reminder: now + 60 * 60 * 1000, priority: "none", images: [], checklist: [],
      folderId: null, order: 0, createdAt: now, updatedAt: now,
    }]));
  }, { title });
}

// Przycisk „Gotowe” w powiadomieniu przy zamkniętej aplikacji: worker otwiera `/notatka/<id>?akcja=done`.
test("akcja z powiadomienia przy zamkniętej aplikacji odhacza przypomnienie raz", async ({ page }) => {
  await seedReminder(page, "Odebrać rury z hurtowni");
  await page.goto("/notatka/r1?akcja=done");

  await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Przypomnienie odhaczone" })).toBeVisible();
  // Parametr znika, żeby odświeżenie nie wykonało akcji drugi raz.
  await expect(page).not.toHaveURL(/akcja=/);

  await page.goto("/przypomnienia");
  await expect(page.getByText("Odebrać rury z hurtowni")).toHaveCount(0);
});
