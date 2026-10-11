import { test, expect } from "@playwright/test";

const NOW = new Date(2026, 9, 14, 12, 0).getTime();
const base = {
  content: "", color: "default", pinned: false, archived: false, trashed: false, trashedAt: null,
  labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null,
  createdAt: NOW - 5000,
};

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript((notes) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy-notes-data", JSON.stringify(notes));
  }, [
    { ...base, id: "a", title: "Remont", order: 0, updatedAt: NOW - 1000 },
    { ...base, id: "b", title: "Łazienka", order: 1, updatedAt: NOW - 2000, parentId: "a" },
    { ...base, id: "c", title: "Sierota", order: 2, updatedAt: NOW - 3000, parentId: "nie-istnieje" },
  ]);
  await page.goto("/");
});

test("kafle pokazują rodzica i liczbę podstron; sierota zostaje na poziomie głównym", async ({ page }) => {
  const parent = page.locator('[data-note-id-wrap="a"]');
  const child = page.locator('[data-note-id-wrap="b"]');
  const orphan = page.locator('[data-note-id-wrap="c"]');

  await expect(parent.locator("[data-subpage-row]")).toContainText("1 podstrona");
  await expect(child.getByRole("button", { name: /Remont/ })).toBeVisible();
  await expect(orphan).toBeVisible();
  await expect(orphan.locator("[data-subpage-row]")).toHaveCount(0);
});

test("czytnik: okruszki, lista podstron i przejście do dziecka", async ({ page }) => {
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Home");
  await page.keyboard.press(" ");

  const parentReader = page.getByRole("dialog", { name: "Remont" });
  await expect(parentReader).toBeVisible();
  await expect(parentReader.locator("[data-subpages]")).toContainText("Podstrony (1)");

  await parentReader.locator("[data-subpages]").getByRole("button", { name: "Łazienka" }).click();
  const childReader = page.getByRole("dialog", { name: "Łazienka" });
  await expect(childReader.getByRole("navigation", { name: "Ścieżka podstrony" })).toContainText("Remont");

  await childReader.getByRole("button", { name: "Remont" }).click();
  await expect(page.getByRole("dialog", { name: "Remont" })).toBeVisible();
});

test("wybór notatki nadrzędnej nie pozwala na cykl", async ({ page }) => {
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Home");
  await page.keyboard.press(" ");

  const reader = page.getByRole("dialog", { name: "Remont" });
  const select = reader.getByLabel("Notatka nadrzędna");
  // Potomek („Łazienka”) nie może zostać rodzicem własnego rodzica.
  await expect(select.locator("option", { hasText: "Łazienka" })).toHaveCount(0);
  await expect(select.locator("option", { hasText: "Sierota" })).toHaveCount(1);

  await select.selectOption({ label: "Sierota" });
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-note-id-wrap="a"]').getByRole("button", { name: /Sierota/ })).toBeVisible();
});
