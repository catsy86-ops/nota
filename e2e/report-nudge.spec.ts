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
