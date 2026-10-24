import { test, expect, type Page } from "@playwright/test";

// Boczny panel czytnika (Faza 3.6): od xl linki, pola i graf w zakładkach; poniżej xl pod treścią.
const NOW = new Date(2026, 9, 24, 12, 0).getTime();
const base = {
  color: "default", pinned: false, archived: false, trashed: false, trashedAt: null,
  labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null,
  createdAt: NOW - 1000, updatedAt: NOW - 1000,
};

async function seed(page: Page, notes: unknown[]) {
  await page.addInitScript((n) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy-notes-data", JSON.stringify(n));
  }, notes);
}

async function openFirstInReader(page: Page) {
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Home");
  await page.keyboard.press(" ");
}

const notes = [
  { ...base, id: "z", title: "Zakupy", order: 0, updatedAt: NOW, content: "Lista do [[Plan]]" },
  { ...base, id: "p", title: "Plan", order: 3, updatedAt: NOW - 5000, content: "Cel" },
  { ...base, id: "s", title: "Start", order: 5, updatedAt: NOW - 5000, content: "Otwórz [[Zakupy]]" },
];

test.describe("szeroki ekran (xl)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("panel z zakładkami: Linki pokazuje linkujące, Graf rysuje sąsiadów", async ({ page }) => {
    await seed(page, notes);
    await page.goto("/");
    await openFirstInReader(page);
    const reader = page.getByRole("dialog", { name: "Zakupy" });
    await expect(reader).toBeVisible();

    const side = reader.locator("[data-reader-side]");
    await expect(side).toBeVisible();
    await expect(reader.getByRole("tab", { name: "Linki" })).toHaveAttribute("aria-selected", "true");
    await expect(side).toContainText("Start");

    await reader.getByRole("tab", { name: "Graf" }).click();
    await expect(side.locator("[data-local-graph]")).toBeVisible();
    await expect(side.locator("[data-graph-node]")).toHaveCount(3);
  });
});

test("Ctrl+klik na [[link]] otwiera notatkę w zakładce „Obok”, czytana zostaje", async ({ page }) => {
  await seed(page, notes);
  await page.goto("/");
  await openFirstInReader(page);
  const reader = page.getByRole("dialog", { name: "Zakupy" });
  await expect(reader).toBeVisible();

  await page.keyboard.down("Control");
  await reader.locator(".prose").getByText("Plan", { exact: true }).click();
  await page.keyboard.up("Control");

  await expect(reader.getByRole("tab", { name: "Obok" })).toHaveAttribute("aria-selected", "true");
  await expect(reader.locator('[data-split-note="p"]')).toContainText("Cel");
  // Czytana notatka się nie zmieniła.
  await expect(page.getByRole("dialog", { name: "Zakupy" })).toBeVisible();
});

test.describe("wąski ekran (poniżej xl)", () => {
  test.use({ viewport: { width: 900, height: 900 } });

  test("bez panelu: linki stoją pod treścią, graf jest na dole", async ({ page }) => {
    await seed(page, notes);
    await page.goto("/");
    await openFirstInReader(page);
    const reader = page.getByRole("dialog", { name: "Zakupy" });
    await expect(reader).toBeVisible();

    await expect(reader.locator("[data-reader-side]")).toHaveCount(0);
    await expect(reader.getByRole("tab", { name: "Linki" })).toHaveCount(0);
    await expect(reader.getByText("Linkują tutaj")).toBeVisible();
    await expect(reader.locator("[data-local-graph] [data-graph-node]")).toHaveCount(3);
  });
});
