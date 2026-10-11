import { test, expect } from "@playwright/test";

const NOW = new Date(2026, 9, 14, 12, 0).getTime();
const base = {
  content: "treść", color: "default", pinned: false, archived: false, trashed: false, trashedAt: null,
  labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null,
  createdAt: NOW - 1000, updatedAt: NOW - 1000,
};

test("notatka „szeroka” zajmuje dwie kolumny, „większy tekst” zmienia rozmiar treści", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript((n) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy-notes-data", JSON.stringify(n));
  }, [
    { ...base, id: "a", title: "Szeroka", order: 0, wide: true, largeText: true },
    { ...base, id: "b", title: "Zwykła", order: 1 },
  ]);
  await page.goto("/");

  const wide = page.locator('[data-note-id-wrap="a"]');
  const plain = page.locator('[data-note-id-wrap="b"]');
  await expect(wide).toHaveClass(/sm:col-span-2/);
  await expect(plain).not.toHaveClass(/sm:col-span-2/);
  await expect(wide.locator(".card-body")).toHaveClass(/text-base/);
  await expect(plain.locator(".card-body")).not.toHaveClass(/text-base/);
});
