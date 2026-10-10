import { test, expect, type Page } from "@playwright/test";

// Niedziela 27 IX 2026, 19:00 — w oknie przeglądu (niedziela od 17:00 do poniedziałku do 12:00).
const SUNDAY_EVENING = new Date(2026, 8, 27, 19, 0);
const DAY = 24 * 60 * 60 * 1000;
const NOW = SUNDAY_EVENING.getTime();

const base = {
  content: "", color: "default", pinned: false, archived: false, trashed: false, trashedAt: null,
  labels: ["x"], reminder: null, priority: "none", images: [], checklist: [], folderId: null, order: 0,
};
const note = (id: string, title: string, extra: Record<string, unknown> = {}) => ({
  ...base, id, title, createdAt: NOW - 60 * DAY, updatedAt: NOW, ...extra,
});

const NOTES = [
  note("s1", "Stara pierwsza", { updatedAt: NOW - 50 * DAY }),
  note("s2", "Stara druga", { updatedAt: NOW - 40 * DAY }),
  note("l1", "Zakupy", { updatedAt: NOW - 10 * DAY, checklist: [{ id: "c1", text: "mleko", checked: false }] }),
  note("o1", "Opłata za prąd", { reminder: NOW - 2 * DAY }),
  note("u1", "Luźna myśl", { labels: [] }),
];

async function start(page: Page, opts: { at?: Date; notes?: unknown[]; storage?: Record<string, string> } = {}) {
  await page.clock.setFixedTime(opts.at ?? SUNDAY_EVENING);
  await page.addInitScript(({ notes, storage }) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.confirmPrefs.v1", JSON.stringify({ trash: false, archive: false }));
    localStorage.setItem("kaczy-notes-data", JSON.stringify(notes));
    for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, v);
  }, { notes: opts.notes ?? NOTES, storage: opts.storage ?? {} });
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto("/dzis");
}

const card = (page: Page) => page.getByTestId("weekly-review");

test("niedziela wieczorem: karta z licznikami i przykładami", async ({ page }) => {
  await start(page);
  await expect(card(page)).toBeVisible();
  const count = (key: string) => card(page).locator(`[data-review-category="${key}"] [data-testid="review-count"]`);
  await expect(count("overdue")).toHaveText("1");
  await expect(count("openLists")).toHaveText("1");
  await expect(count("stale")).toHaveText("2");
  await expect(count("unsorted")).toHaveText("1");
  await expect(card(page).locator('[data-review-category="stale"]')).toContainText("Stara pierwsza");
});

test("poza oknem, przy wyłączeniu i bez zawartości karty nie ma", async ({ page, context }) => {
  await start(page, { at: new Date(2026, 8, 27, 16, 0) });
  await expect(page.locator("main")).toBeVisible();
  await expect(card(page)).toHaveCount(0);
  await page.close();

  const off = await context.newPage();
  await start(off, { storage: { "kaczy:review.day": '"off"' } });
  await expect(off.locator("main")).toBeVisible();
  await expect(card(off)).toHaveCount(0);
  await off.close();

  const empty = await context.newPage();
  await start(empty, { notes: [note("f1", "Świeża")] });
  await expect(empty.locator("main")).toBeVisible();
  await expect(card(empty)).toHaveCount(0);
});

test("poniedziałek rano karta jest, a „Przypomnij jutro” chowa ją także po odświeżeniu", async ({ page }) => {
  await start(page, { at: new Date(2026, 8, 28, 8, 30) });
  await expect(card(page)).toBeVisible();
  await card(page).getByRole("button", { name: "Przypomnij jutro" }).click();
  await expect(card(page)).toHaveCount(0);
  await page.reload();
  await expect(page.locator("main")).toBeVisible();
  await expect(card(page)).toHaveCount(0);
});

test("zamknięcie na ten tydzień zapisuje się w kaczy:review.closed", async ({ page }) => {
  await start(page);
  await card(page).getByRole("button", { name: "Zamknij na ten tydzień" }).click();
  await expect(card(page)).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("kaczy:review.closed"))).toBe('"2026-09-27"');
});

test("archiwizacja z karty: pozycja znika, toast ma Cofnij", async ({ page }) => {
  await start(page);
  const row = card(page).locator('[data-review-note="s1"]');
  await row.getByRole("button", { name: "Archiwizuj" }).click();
  await expect(row).toHaveCount(0);
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Zarchiwizowano" })).toContainText("Cofnij");
});

test("tryb po kolei: klawisze k / a / strzałka i podsumowanie", async ({ page }) => {
  await start(page);
  await card(page).getByRole("button", { name: "Przejrzyj po kolei" }).click();
  const dialog = page.getByTestId("review-walkthrough");
  await expect(dialog).toContainText("1 / 5");
  await expect(dialog).toContainText("Opłata za prąd"); // zaległe przypomnienia idą pierwsze
  await page.keyboard.press("k");
  await expect(dialog).toContainText("2 / 5");
  await page.keyboard.press("a");
  await expect(dialog).toContainText("3 / 5");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("review-summary")).toContainText("Zostawiono 1, zarchiwizowano 1, do kosza 0, pominięto 3");
  await dialog.getByRole("button", { name: "Gotowe" }).click();
  await expect(card(page)).toHaveCount(0);
});
