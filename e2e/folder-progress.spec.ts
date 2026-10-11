import { test, expect } from "@playwright/test";

const NOW = new Date(2026, 9, 14, 12, 0).getTime();
const note = (id: string, folderId: string | null, content: string, extra: Record<string, unknown> = {}) => ({
  id, title: id, content, color: "default", pinned: false, archived: false, trashed: false, trashedAt: null,
  labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId, order: 0,
  createdAt: NOW - 1000, updatedAt: NOW - 1000, ...extra,
});
const folder = (id: string, name: string, parentId: string | null) => ({ id, name, color: "default", emoji: null, parentId, order: 0, createdAt: NOW });

test("pasek boczny: folder pokazuje postęp zadań razem z podfolderami", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(([n, f]) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy-notes-data", JSON.stringify(n));
    localStorage.setItem("kaczy-notes-folders", JSON.stringify(f));
  }, [
    [
      note("a", "p", "- [x] jeden\n- [ ] dwa"),
      note("b", "c", "- [ ] trzy", { checklist: [{ id: "x", text: "z listy", checked: true }] }),
      note("c", "c", "- [ ] zarchiwizowane", { archived: true }),
      note("d", "e", "bez zadań"),
    ],
    [folder("p", "Projekt", null), folder("c", "Dziecko", "p"), folder("e", "Pusty", null)],
  ] as const);
  await page.goto("/");

  await expect(page.locator('[data-folder-progress="p"]')).toContainText("2/4");
  await expect(page.locator('[data-folder-progress="c"]')).toContainText("1/2");
  await expect(page.locator('[data-folder-progress="e"]')).toHaveCount(0);
});
