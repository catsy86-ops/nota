import { test, expect } from "@playwright/test";

// Dziś: karta „Przed wejściem” z dzisiejszą budową (2.4 planu Praca 2026-10-24). „Wpis tutaj” otwiera arkusz wpisu.

const NOW = new Date(2026, 9, 14, 12, 0).getTime();

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  await page.addInitScript((now) => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      journal: [
        { id: "a", at: now - 3600_000, kind: "ok", topic: null, text: "Próba szczelności pionu", site: "Lipowa 5", checked: [], images: [] },
      ],
    }));
  }, NOW);
});

test("Dziś: karta przed wejściem pokazuje dzisiejszą budowę i „Wpis tutaj” otwiera arkusz", async ({ page }) => {
  await page.goto("/dzis");
  const card = page.getByRole("region", { name: "Przed wejściem na budowę" });
  await expect(card).toBeVisible();
  await expect(card).toContainText("Lipowa 5");
  await card.getByRole("button", { name: "Wpis tutaj" }).click();
  await expect(page).toHaveURL(/\/praca\?/);
  await expect(page.getByRole("dialog").first()).toBeVisible();
});
