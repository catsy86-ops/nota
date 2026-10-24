import { test, expect, type Page } from "@playwright/test";

// Lokalny graf w czytniku (Faza 3.5): sąsiedzi do dwóch kroków, filtr etykiety, układ z Workera.
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

/** Pierwsza notatka na liście (order 0) zaznaczana przez Home; spacja otwiera czytnik. */
async function openFirstInReader(page: Page) {
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Home");
  await page.keyboard.press(" ");
}

test("lokalny graf pokazuje sąsiadów do dwóch kroków i filtr etykiety go zawęża", async ({ page }) => {
  await seed(page, [
    { ...base, id: "z", title: "Zakupy", order: 0, updatedAt: NOW, content: "Lista do [[Plan]] i [[Start]]", labels: ["dom"] },
    { ...base, id: "p", title: "Plan", order: 3, updatedAt: NOW - 5000, content: "Krok w [[Remont]]", labels: ["dom"] },
    { ...base, id: "r", title: "Remont", order: 4, updatedAt: NOW - 6000, content: "Materiały", labels: ["praca"] },
    { ...base, id: "s", title: "Start", order: 5, updatedAt: NOW - 5000, content: "Otwórz [[Zakupy]]" },
    { ...base, id: "x", title: "Daleko", order: 6, updatedAt: NOW - 7000, content: "Patrz [[Remont]]" },
  ]);
  await page.goto("/");
  await openFirstInReader(page);
  const reader = page.getByRole("dialog", { name: "Zakupy" });
  await expect(reader).toBeVisible();
  // Na szerokim ekranie graf siedzi w zakładce „Graf” bocznego panelu (od xl).
  await reader.getByRole("tab", { name: "Graf" }).click();

  const local = reader.locator("[data-local-graph]");
  await expect(local.getByTestId("link-graph")).toBeVisible();
  // Zakupy + Plan + Start (krok 1) + Remont (krok 2). „Daleko” jest w kroku 3 — odpada.
  const nodes = local.locator("[data-graph-node]");
  await expect(nodes).toHaveCount(4);
  await expect(local.locator('[data-graph-node="x"]')).toHaveCount(0);

  // Etykieta „praca” zostawia tylko pasujących sąsiadów; Remont jest dalej, więc odpada.
  await local.getByTestId("graph-filter-label").selectOption("praca");
  await expect(local.getByTestId("link-graph-empty")).toContainText("Brak połączeń w wybranych filtrach");
});

test("klik w węzeł lokalnego grafu otwiera tę notatkę", async ({ page }) => {
  await seed(page, [
    { ...base, id: "z", title: "Zakupy", order: 0, updatedAt: NOW, content: "Lista do [[Plan]]" },
    { ...base, id: "p", title: "Plan", order: 3, updatedAt: NOW - 5000, content: "Cel" },
  ]);
  await page.goto("/");
  await openFirstInReader(page);
  const reader = page.getByRole("dialog", { name: "Zakupy" });
  await expect(reader).toBeVisible();
  await reader.getByRole("tab", { name: "Graf" }).click();
  await reader.locator('[data-local-graph] [data-graph-node="p"]').click();
  await expect(page.getByRole("dialog", { name: "Plan" })).toBeVisible();
});
