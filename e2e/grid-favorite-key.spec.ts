import { test, expect } from "@playwright/test";

// Partia 2 QoL: klawisz F na kaflu dodaje do ulubionych (widać w pasku bocznym).

const NOW = new Date(2026, 9, 14, 12, 0).getTime();
const note = (id: string, title: string) => ({
  id, title, content: "Treść", color: "default", pinned: false, archived: false, trashed: false, trashedAt: null,
  labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null, order: 0,
  createdAt: NOW - 1000, updatedAt: NOW - 1000,
});

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript((n) => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy-notes-data", JSON.stringify(n));
  }, [note("a", "Alfa"), note("b", "Beta")]);
});

test("klawisz F na zaznaczonym kaflu dodaje notatkę do ulubionych", async ({ page }) => {
  await page.goto("/");
  await page.locator("body").click({ position: { x: 900, y: 900 } });
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("f");
  // Kolejność kafli przy równych datach jest dowolna — ważne, że dokładnie jedna notatka trafiła do ulubionych.
  await expect(page.locator("[data-favorites] > div")).toHaveCount(1);
});
