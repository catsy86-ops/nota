import { test, expect, type Page } from "@playwright/test";

// „Raport dnia gotowy”: przypomnienie po zmianie (tu: bez Grafiku, godzina zastępcza 17:00)
// i wejście jednym stuknięciem do raportu z dzisiejszymi wpisami.

async function seed(page: Page, hour: number) {
  await page.clock.setFixedTime(new Date(2026, 9, 14, hour, 30).getTime());
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      site: "Lipowa 5",
      journal: [
        { id: "a", at: new Date(2026, 9, 14, 9).getTime(), kind: "ok", topic: null, text: "Podejścia w łazience", site: "Lipowa 5", checked: [], images: [] },
        { id: "b", at: new Date(2026, 9, 13, 9).getTime(), kind: "ok", topic: null, text: "Wczorajszy wpis", site: "Lipowa 5", checked: [], images: [] },
      ],
    }));
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
}

test("po końcu dnia pracy: dymek „Raport dnia gotowy” prowadzi do raportu z dziś, drugi raz tego dnia się nie pokazuje", async ({ page }) => {
  await seed(page, 18);
  await page.goto("/");
  const toast = page.locator("[data-sonner-toast]").filter({ hasText: "Raport dnia gotowy" });
  await expect(toast).toBeVisible();
  await expect(toast).toContainText("1 wpis z dziś");
  await toast.getByRole("button", { name: "Otwórz raport" }).click();

  await expect(page).toHaveURL(/\/praca/);
  const report = page.getByTestId("journal-report");
  await expect(report).toBeVisible();
  await expect(report).toContainText("14 października 2026");
  await expect(report).toContainText("Podejścia w łazience");
  await expect(report).not.toContainText("Wczorajszy wpis");

  await page.keyboard.press("Escape");
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 }).or(page.locator("main")).first()).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Raport dnia gotowy" })).toHaveCount(0);
});

test("przed końcem dnia pracy nie ma przypomnienia", async ({ page }) => {
  await seed(page, 12);
  await page.goto("/");
  await expect(page.locator("main").first()).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Raport dnia gotowy" })).toHaveCount(0);
});

test("adres z powiadomienia `/praca?raport=dzis` otwiera raport dnia i znika z paska adresu", async ({ page }) => {
  await seed(page, 12);
  await page.goto("/praca?raport=dzis");
  const report = page.getByTestId("journal-report");
  await expect(report).toBeVisible();
  await expect(report).toContainText("Podejścia w łazience");
  await expect(page).not.toHaveURL(/raport=/);
});

/** Wpisy z kilku budów; `day`/`hour` — chwila „teraz”. */
async function seedSites(page: Page, day: number, hour: number, entries: { id: string; day: number; site: string; text: string }[]) {
  await page.clock.setFixedTime(new Date(2026, 9, day, hour, 30).getTime());
  await page.addInitScript((list) => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      site: list[0].site,
      journal: list.map((x) => ({ id: x.id, at: new Date(2026, 9, x.day, 9).getTime(), kind: "ok", topic: null, text: x.text, site: x.site, checked: [], images: [] })),
    }));
  }, entries);
  await page.setViewportSize({ width: 1440, height: 1000 });
}

test("kilka budów jednego dnia: raport dnia otwiera się od razu na wszystkich budowach", async ({ page }) => {
  // 14.10.2026 to środa — tylko raport dnia.
  await seedSites(page, 14, 18, [
    { id: "a", day: 14, site: "Lipowa 5", text: "Podejścia w łazience" },
    { id: "b", day: 14, site: "Polna 2", text: "Kanalizacja w garażu" },
  ]);
  await page.goto("/");
  const toast = page.locator("[data-sonner-toast]").filter({ hasText: "Raport dnia gotowy" });
  await expect(toast).toContainText("na 2 budowach");
  await toast.getByRole("button", { name: "Otwórz raport" }).click();
  const report = page.getByTestId("journal-report");
  await expect(report.getByRole("combobox", { name: "Budowa raportu" }).locator("option:checked")).toHaveText("Wszystkie budowy");
  await expect(report).toContainText("Podejścia w łazience");
  await expect(report).toContainText("Kanalizacja w garażu");
});

test("piątek po pracy: „Raport tygodnia gotowy” zamiast dnia — 7 dni, wszystkie budowy", async ({ page }) => {
  // 16.10.2026 to piątek.
  await seedSites(page, 16, 18, [
    { id: "a", day: 12, site: "Lipowa 5", text: "Kanalizacja podposadzkowa" },
    { id: "b", day: 14, site: "Polna 2", text: "Piony" },
    { id: "c", day: 16, site: "Lipowa 5", text: "Próba szczelności" },
    { id: "stary", day: 2, site: "Lipowa 5", text: "Sprzed tygodnia" },
  ]);
  await page.goto("/");
  const toast = page.locator("[data-sonner-toast]").filter({ hasText: "Raport tygodnia gotowy" });
  await expect(toast).toContainText("3 wpisy z 7 dni na 2 budowach");
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Raport dnia gotowy" })).toHaveCount(0);
  await toast.getByRole("button", { name: "Otwórz raport" }).click();
  const report = page.getByTestId("journal-report");
  await expect(report).toContainText("10–16 października 2026");
  await expect(report).toContainText("Kanalizacja podposadzkowa");
  await expect(report).toContainText("Piony");
  await expect(report).not.toContainText("Sprzed tygodnia");
});

test("adres `/praca?raport=tydzien-wszystkie` otwiera raport 7 dni wszystkich budów", async ({ page }) => {
  await seedSites(page, 14, 12, [
    { id: "a", day: 10, site: "Lipowa 5", text: "Kanalizacja podposadzkowa" },
    { id: "b", day: 13, site: "Polna 2", text: "Piony" },
  ]);
  await page.goto("/praca?raport=tydzien-wszystkie");
  const report = page.getByTestId("journal-report");
  await expect(report.getByRole("combobox", { name: "Budowa raportu" }).locator("option:checked")).toHaveText("Wszystkie budowy");
  await expect(report).toContainText("8–14 października 2026");
  await expect(report).toContainText("Kanalizacja podposadzkowa");
  await expect(report).toContainText("Piony");
});
