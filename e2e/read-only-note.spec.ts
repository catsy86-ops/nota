import { test, expect } from "@playwright/test";

const NOW = new Date(2026, 9, 14, 12, 0).getTime();

test("zablokowana notatka nie wchodzi w edycję, a „Odblokuj” to przywraca", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript((n) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy-notes-data", JSON.stringify(n));
  }, [{
    id: "a", title: "Zamknięta", content: "treść", color: "default", pinned: false, archived: false, trashed: false, trashedAt: null,
    labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null, order: 0,
    createdAt: NOW - 1000, updatedAt: NOW - 1000, readOnly: true,
  }]);
  await page.goto("/");

  const card = page.getByRole("article", { name: "Zamknięta" });
  await card.locator("h3").click();
  await expect(page.getByText("Notatka jest zablokowana do edycji")).toBeVisible();
  await expect(page.getByPlaceholder("Treść notatki...")).toHaveCount(0);

  await page.getByRole("button", { name: "Odblokuj" }).click();
  await card.locator("h3").click();
  await expect(page.getByPlaceholder("Treść notatki...")).toHaveCount(1);
});
