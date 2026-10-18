import { test, expect } from "@playwright/test";

const NOW = new Date(2026, 9, 14, 12, 0).getTime();
const note = (id: string, title: string, content: string, extra: Record<string, unknown> = {}) => ({
  id, title, content, color: "default", pinned: false, archived: false, trashed: false, trashedAt: null,
  labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null, order: 0,
  createdAt: NOW - 1000, updatedAt: NOW - 1000, ...extra,
});

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

test("„Kopiuj jako Markdown” w menu „Więcej opcji” kopiuje notatkę do schowka", async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript((n) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy-notes-data", JSON.stringify(n));
  }, [note("a", "Alfa", "Pierwsza **treść**")]);
  await page.goto("/");

  const card = page.getByRole("article", { name: "Alfa" });
  await card.getByRole("button", { name: "Więcej opcji" }).click();
  await card.getByRole("button", { name: "Kopiuj jako Markdown" }).click();

  await expect(page.getByText("Skopiowano")).toBeVisible();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain("Alfa");
  expect(clip).toContain("Pierwsza **treść**");
});
