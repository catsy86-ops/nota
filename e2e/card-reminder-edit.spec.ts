import { test, expect } from "@playwright/test";

const NOW = new Date(2026, 9, 14, 12, 0).getTime();
const note = (id: string, title: string, extra: Record<string, unknown> = {}) => ({
  id, title, content: "Treść", color: "default", pinned: false, archived: false, trashed: false, trashedAt: null,
  labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null, order: 0,
  createdAt: NOW - 1000, updatedAt: NOW - 1000, ...extra,
});

test("karta: odznaka przypomnienia otwiera okno z godziną i zapisuje nową", async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript((n) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy-notes-data", JSON.stringify(n));
  }, [note("a", "Alfa", { reminder: new Date(2026, 9, 14, 15, 30).getTime() })]);
  await page.goto("/");

  const card = page.getByRole("article", { name: "Alfa" });
  const badge = card.getByRole("button", { name: /dziś, 15:30/ });
  await expect(badge).toBeVisible();
  await badge.click();

  const time = page.getByLabel("Godzina:");
  await expect(time).toHaveValue("15:30");
  await time.fill("16:45");
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();

  await expect(card.getByRole("button", { name: /dziś, 16:45/ })).toBeVisible();
});
