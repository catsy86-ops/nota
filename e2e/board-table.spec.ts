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

// 2b.5: przyklejone nagłówki kolumn i przenoszenie kafla dotykiem.
const LONG = [
  ...Array.from({ length: 30 }, (_, i) => note(`p${i}`, `Praca ${i}`, { labels: ["praca"], content: "Linia\n\nLinia" })),
  note("n-c", "Gamma", { labels: ["dom"] }),
];

async function seedNotes(page: Page, notes: unknown[]) {
  await page.addInitScript((n) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy-notes-data", JSON.stringify(n));
    localStorage.setItem("kaczy.viewPrefs.v1", JSON.stringify({ layout: "board" }));
    // Okienko osiągnięcia („Pierwszy krok”) zasłaniałoby kafle na wąskim ekranie.
    const ids = ["first-note", "first-list", "ten-notes", "fifty-notes", "pin-master", "labeler", "folder-fan", "checklist-hero", "veteran", "week-streak"];
    localStorage.setItem("kaczy.achievements.v1", JSON.stringify({ maxStats: {}, unlockedAt: Object.fromEntries(ids.map((id) => [id, 1])) }));
  }, notes);
  await page.goto("/");
}

test("tablica: pasek nagłówków przykleja się po przewinięciu i idzie za przewijaniem w poziomie", async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 800 });
  await seedNotes(page, LONG);
  const strip = page.locator("[data-board-sticky]");
  await expect(page.locator("[data-board-column]")).toHaveCount(2);
  await expect(strip).not.toHaveAttribute("data-stuck", "true");

  await page.mouse.wheel(0, 1500);
  await expect(strip).toHaveAttribute("data-stuck", "true");
  // Pasek leży pod nagłówkiem aplikacji (albo na górze, gdy nagłówek się schował) — w widoku.
  await expect.poll(async () => (await strip.boundingBox())!.y).toBeLessThan(90);
  await expect(strip).toContainText("praca");

  // Przewinięcie tablicy w bok przesuwa pasek tak samo jak kolumny.
  const pill = strip.locator("> div > div > *").nth(1);
  const col = page.locator('[data-board-column="praca"]');
  await page.locator("[data-board]").evaluate((el) => { el.scrollLeft = 200; });
  await expect.poll(async () => Math.abs((await pill.boundingBox())!.x - (await col.boundingBox())!.x)).toBeLessThan(2);

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(strip).not.toHaveAttribute("data-stuck", "true");
});

test.describe("tablica na telefonie", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("dotyk: przytrzymanie uchwytu i przeciągnięcie przenosi kafel do innej kolumny", async ({ page }) => {
    await seedNotes(page, NOTES);
    await expect(page.locator("[data-board-column]")).toHaveCount(3);
    const handle = page.locator('[data-note-id-wrap="n-c"]').getByLabel("Przeciągnij, aby zmienić kolejność");
    // Domyślny porządek nie jest ręczny, a uchwyt i tak jest widoczny — w tablicy służy do zmiany kolumny.
    await expect(handle).toBeVisible();

    // Szuflada menu po starcie na telefonie gaśnie — jej tło przez chwilę łapie dotyk.
    await expect(page.locator(".fixed.inset-0.z-40")).toHaveCount(0);
    const target = page.locator('[data-board-column="praca"]');
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: string, x: number, y: number) =>
      cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
    const start = (await handle.boundingBox())!;
    const sx = start.x + start.width / 2, sy = start.y + start.height / 2;
    await touch("touchStart", sx, sy);
    await page.waitForTimeout(350);
    const to = (await target.boundingBox())!;
    const tx = Math.min(to.x + to.width / 2, 380), ty = to.y + 60;
    for (let i = 1; i <= 15; i++) await touch("touchMove", sx + ((tx - sx) * i) / 15, sy + ((ty - sy) * i) / 15);
    await touch("touchEnd", tx, ty);

    await expect(page.locator('[data-board-column="praca"] [data-note-id-wrap="n-c"]')).toHaveCount(1);
    // Ruch w bok zaczęty na uchwycie nie jest przesunięciem kafla (to archiwizowało notatkę).
    await expect(page.getByText("Zarchiwizowano")).toHaveCount(0);
  });

  test("dotyk: przesunięcie kafla w prawo (poza uchwytem) nadal archiwizuje", async ({ page }) => {
    await seedNotes(page, NOTES);
    await expect(page.locator(".fixed.inset-0.z-40")).toHaveCount(0);
    const box = (await page.locator('[data-note-id-wrap="n-c"]').boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: string, x: number, y: number) =>
      cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
    const sx = box.x + 40, sy = box.y + box.height / 2;
    await touch("touchStart", sx, sy);
    for (let i = 1; i <= 10; i++) await touch("touchMove", sx + i * 18, sy);
    await touch("touchEnd", sx + 180, sy);
    await expect(page.getByText("Zarchiwizowano")).toBeVisible();
  });
});
