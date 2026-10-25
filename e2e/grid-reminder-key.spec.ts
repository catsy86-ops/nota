import { test, expect } from "@playwright/test";

// Klawisz R na kaflu otwiera okno przypomnienia tego kafla; skrót PWA „Na dziś” prowadzi do widżetu.

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
  }, [note("a", "Alfa")]);
});

test("klawisz R na kaflu otwiera przypomnienie", async ({ page }) => {
  await page.goto("/");
  await page.locator("body").click({ position: { x: 900, y: 900 } });
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("r");
  await expect(page.getByLabel("Godzina:")).toBeVisible();
});

test("manifest ma skrót „Na dziś” do widżetu", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  const json = await res.json();
  expect(json.shortcuts.map((s: { url: string }) => s.url)).toContain("/widget");
});
