import { test, expect } from "@playwright/test";

// Klawiatura (audyt UI, pkt 8): treść kafla dostaje fokus, a Enter otwiera notatkę jak klik.

const NOW = new Date(2026, 9, 14, 12, 0).getTime();

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript((now) => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy-notes-data", JSON.stringify([
      { id: "a", title: "Alfa", content: "Treść", color: "default", pinned: false, archived: false, trashed: false, trashedAt: null,
        labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null, order: 0, createdAt: now - 1000, updatedAt: now - 1000 },
    ]));
  }, NOW);
});

test("Enter na zfokusowanej treści kafla otwiera notatkę", async ({ page }) => {
  await page.goto("/");
  const body = page.locator('[data-note-id="a"] .card-body');
  await body.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-note-id="a"]')).toHaveAttribute("data-tile-editing", "");
});
