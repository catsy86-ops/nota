import { test, expect } from "@playwright/test";
import { addNote } from "./helpers";

// Dziś 2.5: pasek „Zapisz notatkę…” w widoku Dziś; nowa notatka jest „dzisiejsza”, więc zostaje na ekranie.
test("Dziś: kompozytor zapisuje notatkę bez wychodzenia z widoku", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/dzis");
  await addNote(page, "Telefon do hurtowni");
  await expect(page).toHaveURL(/\/dzis$/);
  await expect(page.locator("[data-note-id]").filter({ hasText: "Telefon do hurtowni" })).toHaveCount(1);
});
