import { test, expect } from "@playwright/test";

// Szybkie przypomnienie (QoL): wpisane „jutro 15” zapisuje się po Enter, bez drugiego kliku w Zapisz.

const NOW = new Date(2026, 9, 14, 12, 0).getTime();

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  await page.addInitScript((now) => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy-notes-data", JSON.stringify([
      { id: "a", title: "Dzwonić", content: "Treść", color: "default", pinned: false, archived: false, trashed: false, trashedAt: null,
        labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null, order: 0, createdAt: now - 1000, updatedAt: now - 1000 },
    ]));
  }, NOW);
});

test("szybkie przypomnienie: „jutro 15” + Enter zapisuje termin", async ({ page }) => {
  await page.goto("/");
  const card = page.getByRole("article", { name: "Dzwonić" });
  await card.getByRole("button", { name: "Przypomnienie", exact: true }).click();
  await page.getByPlaceholder("np. jutro 15:00, za 2h").fill("jutro 15");
  await page.getByPlaceholder("np. jutro 15:00, za 2h").press("Enter");
  await expect(card.getByRole("button", { name: /jutro, 15:00/ })).toBeVisible();
  await expect(page.getByPlaceholder("np. jutro 15:00, za 2h")).toHaveCount(0);
});
