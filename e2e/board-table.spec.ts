import { test, expect, type Page } from "@playwright/test";

const NOW = new Date(2026, 9, 14, 12, 0).getTime();

const note = (id: string, title: string, extra: Record<string, unknown> = {}) => ({
  id, title, content: "", color: "default", pinned: false, archived: false, trashed: false, trashedAt: null,
  labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null, order: 0,
  createdAt: NOW - 1000, updatedAt: NOW - 1000, ...extra,
});

const NOTES = [
  note("n-a", "Alfa", { labels: ["praca"], priority: "high" }),
  note("n-b", "Beta", { labels: ["praca"] }),
  note("n-c", "Gamma", { labels: ["dom"] }),
  note("n-d", "Delta"),
];

async function seed(page: Page, prefs: Record<string, unknown>) {
  await page.clock.setFixedTime(NOW);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(([n, p]) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy-notes-data", JSON.stringify(n));
    localStorage.setItem("kaczy.viewPrefs.v1", JSON.stringify(p));
  }, [NOTES, prefs] as const);
  await page.goto("/");
}

test("tablica: kolumny wg etykiet (domyślnie), z licznikami i „bez etykiety” na końcu", async ({ page }) => {
  await seed(page, { layout: "board" });
  await expect(page.locator("[data-board-column]")).toHaveCount(3);
  const keys = await page.locator("[data-board-column]").evaluateAll((els) => els.map((e) => e.getAttribute("data-board-column")));
  expect(keys).toEqual(["dom", "praca", "none"]);
  await expect(page.locator('[data-board-column="praca"] [data-note-id-wrap]')).toHaveCount(2);
  await expect(page.locator('[data-board-column="none"] [data-note-id-wrap="n-d"]')).toHaveCount(1);
});

test("tablica: przeciągnięcie karty do innej kolumny zmienia etykietę i pokazuje komunikat", async ({ page }) => {
  await seed(page, { layout: "board" });
  await expect(page.locator("[data-board-column]")).toHaveCount(3);
  const card = page.locator('[data-note-id-wrap="n-c"]');
  await card.hover();
  const handle = card.getByLabel("Przeciągnij, aby zmienić kolejność");
  const from = (await handle.boundingBox())!;
  const to = (await page.locator('[data-board-column="praca"]').boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 20 });
  await page.mouse.up();

  await expect(page.locator('[data-board-column="praca"] [data-note-id-wrap="n-c"]')).toHaveCount(1);
  await expect(page.getByText("Przeniesiono do „#praca”")).toBeVisible();
});

test("tabela: wiersze z kolumnami, sortowanie po nagłówku i otwarcie czytnika", async ({ page }) => {
  await seed(page, { layout: "table" });
  await expect(page.locator("[data-note-row]")).toHaveCount(4);
  await expect(page.locator('[data-note-row="n-a"]')).toContainText("Wysoki");
  await expect(page.locator('[data-note-row="n-a"]')).toContainText("#praca");

  await page.getByRole("button", { name: "Tytuł" }).click();
  const order = await page.locator("[data-note-row]").evaluateAll((els) => els.map((e) => e.getAttribute("data-note-row")));
  expect(order).toEqual(["n-a", "n-b", "n-d", "n-c"]);

  await page.locator('[data-note-row="n-b"]').click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
