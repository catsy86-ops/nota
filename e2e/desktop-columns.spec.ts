import { test, expect, type Locator } from "@playwright/test";

// Plan UI 2.3/2.4: na szerokim ekranie panel stoi obok treści i jest przyklejony; na telefonie
// wszystko w jednej kolumnie, panel pod nagłówkiem widoku (dawna kolejność).
async function box(l: Locator) {
  const b = await l.boundingBox();
  expect(b).not.toBeNull();
  return b!;
}

const JOURNAL = () => {
  localStorage.setItem("kaczy.tour.seen.v1", "1");
  const now = Date.now();
  localStorage.setItem("kaczy.study.v1", JSON.stringify({ journal: [
    { id: "a", at: now - 60_000, kind: "ok", topic: null, text: "Próba szczelności", site: "Lipowa 5", checked: [], images: [] },
    { id: "b", at: now - 120_000, kind: "problem", topic: null, text: "Przeciek", site: "Polna 2", checked: [], images: [] },
  ] }));
};

test.describe("komputer 1440", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.beforeEach(async ({ page }) => { await page.addInitScript(JOURNAL); });

  test("Grafik: paleta i podsumowanie w przyklejonym panelu obok siatki", async ({ page }) => {
    await page.goto("/grafik");
    const aside = page.getByRole("complementary", { name: "Panel Grafiku" });
    const grid = page.getByRole("grid").first();
    expect((await box(aside)).x).toBeGreaterThan((await box(grid)).x + (await box(grid)).width - 1);
    expect(await aside.evaluate((el) => getComputedStyle(el).position)).toBe("sticky");
    await expect(aside.getByText("Przepracowane", { exact: false })).toBeVisible();
  });

  test("Kalendarz: panel wybranego dnia obok siatki miesiąca", async ({ page }) => {
    await page.goto("/kalendarz");
    const aside = page.getByRole("complementary", { name: "Wybrany dzień i najbliższe terminy" });
    const grid = page.getByRole("grid").first();
    expect((await box(aside)).x).toBeGreaterThan((await box(grid)).x + (await box(grid)).width - 1);
    expect(await aside.evaluate((el) => getComputedStyle(el).position)).toBe("sticky");
  });

  test("Dziennik: wpisy do 48 rem, filtry przyklejone obok", async ({ page }) => {
    await page.goto("/praca");
    await page.getByRole("tab", { name: "Dziennik" }).click();
    const filters = page.getByRole("search", { name: "Filtry dziennika" });
    const entry = page.locator("[data-journal-entry]").first();
    expect((await box(entry)).width).toBeLessThanOrEqual(48 * 16 + 1);
    expect((await box(filters)).x).toBeGreaterThan((await box(entry)).x + (await box(entry)).width);
    expect(await filters.evaluate((el) => getComputedStyle(el).position)).toBe("sticky");
  });
});

test.describe("telefon 390", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test.beforeEach(async ({ page }) => { await page.addInitScript(JOURNAL); });

  test("jedna kolumna w dawnej kolejności: paleta nad siatką, filtry nad wpisami @mobile", async ({ page }) => {
    await page.goto("/grafik");
    const palette = page.getByRole("button", { name: "Cykl", exact: true });
    expect((await box(palette)).y).toBeLessThan((await box(page.getByRole("grid").first())).y);

    await page.goto("/praca");
    await page.getByRole("tab", { name: "Dziennik" }).click();
    const filters = page.getByRole("search", { name: "Filtry dziennika" });
    expect((await box(filters)).y).toBeLessThan((await box(page.locator("[data-journal-entry]").first())).y);
    expect(await filters.evaluate((el) => getComputedStyle(el).position)).toBe("static");
  });
});

test("pasek boczny: grupy Codziennie / Praca / Osobiste; grupa zwija się i pamięta stan (PW-4)", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
  const aside = page.getByRole("complementary");
  const praca = aside.locator('[data-sidebar-group="praca"]');
  const header = praca.locator("button[aria-expanded]");
  await expect(header).toBeVisible();
  await header.click();
  await expect(header).toHaveAttribute("aria-expanded", "false");
  await expect(praca.getByRole("button", { name: "Grafik" })).toBeHidden();
  await page.reload();
  await expect(aside.locator('[data-sidebar-group="praca"] button[aria-expanded]')).toHaveAttribute("aria-expanded", "false");
});
