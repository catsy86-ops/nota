import { test, expect } from "@playwright/test";

// Dostawa dziś (2.2 planu Praca 2026-10-24): wiersz na Dziś, a po kliknięciu karta tej budowy (2.1).
// Budowy są w Yjs, więc braki dodajemy przez kartę, tak jak robi to użytkownik.

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

test("dostawa dziś: wiersz na Dziś otwiera kartę budowy", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await page.getByTestId("study-journal").getByRole("button", { name: "Lipowa 5: karta budowy" }).click();
  const panel = page.getByTestId("site-card").getByTestId("site-shortages");
  await panel.getByLabel("Czego brakuje").fill("Klej PCV");
  await panel.getByRole("button", { name: "Dodaj brak" }).click();
  await panel.getByRole("button", { name: "Klej PCV: Brakuje. Zmień status" }).click();
  await panel.getByLabel("Data dostawy: Klej PCV").fill("2026-10-14");
  await page.keyboard.press("Escape");

  await page.goto("/dzis");
  const row = page.getByTestId("study-due").getByRole("button", { name: "Dostawa dziś: Lipowa 5: karta budowy" });
  await expect(row).toContainText("Klej PCV");
  await row.click();
  await expect(page.getByTestId("site-card")).toBeVisible();
});
