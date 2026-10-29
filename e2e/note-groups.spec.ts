import { test, expect, type Page } from "@playwright/test";

// Środa 14.10.2026, 12:00 lokalnie — poniedziałek tego tygodnia to 12.10.
const NOW = new Date(2026, 9, 14, 12, 0).getTime();
const at = (y: number, m: number, d: number, h = 10) => new Date(y, m - 1, d, h, 0).getTime();

const note = (id: string, title: string, updatedAt: number, extra: Record<string, unknown> = {}) => ({
  id, title, content: "", color: "default", pinned: false, archived: false, trashed: false, trashedAt: null,
  labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null, order: 0,
  createdAt: updatedAt, updatedAt, ...extra,
});

const NOTES = [
  note("n-today", "Dzisiejsza", NOW - 3600 * 1000),
  note("n-yest", "Wczorajsza", at(2026, 10, 13)),
  note("n-week", "Tygodniowa", at(2026, 10, 12, 8)),
  note("n-month", "Miesięczna", at(2026, 10, 2)),
  note("n-old", "Stara", at(2026, 8, 1)),
];

async function seed(page: Page, notes: unknown[], prefs: Record<string, unknown> = {}, extra: Record<string, string> = {}) {
  await page.clock.setFixedTime(NOW);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(([n, p, ex]) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy-notes-data", JSON.stringify(n));
    localStorage.setItem("kaczy.viewPrefs.v1", JSON.stringify(p));
    for (const [k, v] of Object.entries(ex as Record<string, string>)) localStorage.setItem(k, v);
  }, [notes, prefs, extra] as const);
  await page.goto("/");
}

const idsInOrder = (page: Page) =>
  page.locator("[data-note-id-wrap]").evaluateAll((els) => els.map((e) => e.getAttribute("data-note-id-wrap")));

test("grupowanie wg daty: sekcje w kolejności, z licznikami, granice tygodnia od poniedziałku", async ({ page }) => {
  await seed(page, NOTES, { groupBy: "date" });
  await expect(page.locator("[data-group]")).toHaveCount(5);
  const labels = await page.locator("[data-group]").evaluateAll((els) => els.map((e) => e.getAttribute("data-group")));
  expect(labels).toEqual(["date-today", "date-yesterday", "date-week", "date-month", "date-older"]);
  await expect(page.locator('[data-group="date-week"]')).toContainText("Ten tydzień");
  await expect(page.locator('[data-group="date-week"] [data-note-id-wrap="n-week"]')).toHaveCount(1);
  await expect(page.locator('[data-group="date-month"] [data-note-id-wrap="n-month"]')).toHaveCount(1);
});

test("opcja „Grupuj” w menu sortowania przełącza podział", async ({ page }) => {
  await seed(page, NOTES);
  await expect(page.locator("[data-group]")).toHaveCount(0);
  await page.getByRole("button", { name: "Sortowanie" }).click();
  await page.getByRole("menuitemradio", { name: "Wg daty" }).click();
  await expect(page.locator('[data-group="date-today"]')).toBeVisible();
});

test("zwinięcie sekcji chowa karty, jest pamiętane po przeładowaniu i pomijane w nawigacji klawiaturą", async ({ page }) => {
  await seed(page, NOTES, { groupBy: "date" });
  await page.locator('[data-group-toggle="date-older"]').click();
  await expect(page.locator('[data-note-id-wrap="n-old"]')).toHaveCount(0);
  await expect(page.locator('[data-group-toggle="date-older"]')).toHaveAttribute("aria-expanded", "false");

  // „End” przechodzi na ostatnią WIDOCZNĄ notatkę (sekcja „Starsze” jest zwinięta).
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("End");
  await expect(page.locator('[data-note-id-wrap="n-month"]')).toHaveClass(/ring-2/);

  await page.reload();
  await expect(page.locator('[data-group-toggle="date-older"]')).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator('[data-note-id-wrap="n-old"]')).toHaveCount(0);

  await page.locator('[data-group-toggle="date-older"]').click();
  await expect(page.locator('[data-note-id-wrap="n-old"]')).toHaveCount(1);
});

test("kolejność sekcji = kolejność nawigacji klawiaturą", async ({ page }) => {
  await seed(page, NOTES, { groupBy: "date", layout: "list" });
  await expect(page.locator('[data-note-id-wrap="n-old"]')).toBeVisible();
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Home");
  await expect(page.locator('[data-note-id-wrap="n-today"]')).toHaveClass(/ring-2/);
  await page.keyboard.press("ArrowDown");
  await expect(page.locator('[data-note-id-wrap="n-yest"]')).toHaveClass(/ring-2/);
});

const pinnedNote = (i: number) => note(`p${i}`, `Przypięta ${i}`, NOW - i * 1000, { pinned: true });

test("Przypięte: do trzech notatek bez zwijania", async ({ page }) => {
  await seed(page, [pinnedNote(1), pinnedNote(2), pinnedNote(3), note("o1", "Zwykła", NOW - 99999)]);
  await expect(page.locator('[data-group="pinned"]')).toBeVisible();
  await expect(page.locator('[data-group-toggle="pinned"]')).toHaveCount(0);
  // „Inne” ma ten sam nagłówek co pozostałe sekcje: z licznikiem.
  await expect(page.locator('[data-group="others"]')).toContainText(/Inne\s*1/);
});

test("Przypięte: powyżej trzech zwijane, z licznikiem i pamiętanym stanem", async ({ page }) => {
  await seed(page, [pinnedNote(1), pinnedNote(2), pinnedNote(3), pinnedNote(4), note("o1", "Zwykła", NOW - 99999)]);
  const toggle = page.locator('[data-group-toggle="pinned"]');
  await expect(toggle).toBeVisible();
  await expect(toggle).toContainText("4");
  await toggle.click();
  await expect(page.locator('[data-note-id-wrap="p1"]')).toHaveCount(0);
  await expect(page.locator('[data-note-id-wrap="o1"]')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('[data-group-toggle="pinned"]')).toHaveAttribute("aria-expanded", "false");
});

test("sortowanie „Ostatnio otwierane” używa lokalnego zapisu, nie dokumentu notatek", async ({ page }) => {
  const notes = [note("a", "Alfa", NOW - 1000), note("b", "Beta", NOW - 2000), note("c", "Gamma", NOW - 3000)];
  await seed(page, notes, { sortKey: "opened", sortDir: "desc" }, {
    "kaczy.lastOpened.v1": JSON.stringify({ c: NOW - 10, b: NOW - 500 }),
  });
  await expect.poll(() => idsInOrder(page)).toEqual(["c", "b", "a"]);

  // Otwarcie notatki zapisuje znacznik w localStorage i wysuwa ją na początek.
  const initialUpdated = await page.evaluate(() => localStorage.getItem("kaczy.lastOpened.v1"));
  await page.locator('[data-note-id-wrap="a"]').getByText("Alfa").click();
  await expect(page.getByPlaceholder("Treść notatki...")).toBeVisible();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("kaczy.lastOpened.v1") || "{}"));
  expect(after.a).toBeGreaterThan(0);
  expect(JSON.stringify(after)).not.toBe(initialUpdated);
});

test("Ctrl+A zaznacza wszystkie widoczne notatki (bez zwiniętych) i nie działa w polu tekstowym", async ({ page }) => {
  await seed(page, NOTES, { groupBy: "date" });
  await page.locator('[data-group-toggle="date-older"]').click();
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+a");
  await expect(page.getByText("zaznaczono")).toBeVisible();
  await expect(page.getByRole("button", { name: /Wszystko \(4\)/ })).toBeVisible();
  await expect(page.locator('[data-note-id-wrap="n-today"] button[aria-label="Odznacz notatkę"]')).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByText("zaznaczono")).toHaveCount(0);
  await page.getByPlaceholder("Szukaj notatek...").first().focus();
  await page.keyboard.press("Control+a");
  await expect(page.getByText("zaznaczono")).toHaveCount(0);
});

test("przeciągnięcie zaznaczonej notatki na folder przenosi wszystkie zaznaczone, z „Cofnij”", async ({ page }) => {
  const folders = [{ id: "f1", name: "Projekty", color: "default", emoji: null, parentId: null, order: 0, createdAt: NOW }];
  await seed(page, NOTES.slice(0, 3), {}, { "kaczy-notes-folders": JSON.stringify(folders) });
  // Ctrl+A zaznacza tylko wczytane notatki — bez czekania skrót trafia w pustą listę.
  await expect(page.locator("[data-note-id-wrap]")).toHaveCount(3);
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+a");
  await expect(page.getByRole("button", { name: /Wszystko \(3\)/ })).toBeVisible();

  const card = page.locator('[data-note-id-wrap="n-today"]');
  await card.hover();
  const handle = card.getByLabel("Przeciągnij, aby zmienić kolejność");
  const from = (await handle.boundingBox())!;
  const to = (await page.locator('[data-folder-drop="f1"]').boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 20 });
  await page.mouse.up();

  await expect(page.getByText(/Przeniesiono do .Projekty. \(3\)/)).toBeVisible();
  await expect(page.getByText("zaznaczono")).toHaveCount(0);
  await page.locator('[data-folder-drop="f1"]').click();
  await expect(page.locator("[data-note-id-wrap]")).toHaveCount(3);

  await page.getByRole("button", { name: "Cofnij" }).first().click();
  await expect(page.locator("[data-note-id-wrap]")).toHaveCount(0);
});
