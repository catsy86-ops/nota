import { test, expect } from "@playwright/test";

// Link `/praca?budowa=<id>` otwiera kartę tej budowy od razu (2.1 planu Praca 2026-10-24).

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 14, 12, 0).getTime());
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    const at = (h: number) => new Date(2026, 9, 14, h).getTime();
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      journal: [
        { id: "a", at: at(8), kind: "ok", topic: null, text: "Próba szczelności pionu", site: "Lipowa 5", siteId: "lipowa", checked: [], images: [] },
      ],
    }));
  });
});

test("link do budowy otwiera jej kartę i zdejmuje parametr z adresu", async ({ page }) => {
  await page.goto("/praca?budowa=lipowa");
  await expect(page.getByTestId("site-card")).toBeVisible();
  await expect(page).toHaveURL(/\/praca$/);
});

test("nieznana budowa w linku nie otwiera karty, zwykły dziennik", async ({ page }) => {
  await page.goto("/praca?budowa=nie-ma-takiej");
  await expect(page.getByTestId("study-journal")).toBeVisible();
  await expect(page.getByTestId("site-card")).toHaveCount(0);
});
