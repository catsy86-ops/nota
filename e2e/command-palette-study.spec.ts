import { test, expect } from "@playwright/test";

// Paleta poleceń: budowy i wpisy z Pracy oraz „Nowy wpis” i „Raport dnia” (2.5 planu Praca 2026-10-24).

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

test("paleta: wpisz nazwę budowy — karta budowy; „Nowy wpis w Pracy” otwiera arkusz", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Control+k");
  const input = page.getByRole("dialog").getByPlaceholder(/szukaj|wpisz|polec/i);
  await input.fill("Lipowa");
  // Paleta i dane Nauki ładują się leniwie — przy obciążonym zestawie daj im czas.
  await expect(page.getByText("Karta budowy: Lipowa 5", { exact: true })).toBeVisible({ timeout: 15_000 });
  await page.getByText("Karta budowy: Lipowa 5", { exact: true }).click();
  await expect(page.getByTestId("site-card")).toBeVisible();
  await expect(page).toHaveURL(/\/praca$/);

  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+k");
  await page.getByRole("dialog").getByPlaceholder(/szukaj|wpisz|polec/i).fill("nowy wpis");
  await page.getByText("Nowy wpis w Pracy", { exact: true }).click();
  await expect(page).toHaveURL(/\/praca/);
});

test("paleta: pytania quizu bez polskich znaków — wynik otwiera quiz z tematu (P4.2)", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Control+k");
  const input = page.getByRole("dialog").getByPlaceholder(/szukaj|wpisz|polec/i);
  await input.fill("tuleja zacisnieciu");
  const hit = page.getByText("Jak powinna wyglądać tuleja po zaciśnięciu?", { exact: true });
  await expect(hit).toBeVisible({ timeout: 15_000 });
  await hit.click();
  await expect(page).toHaveURL(/\/praca$/);
  await expect(page.getByRole("tab", { name: "Quiz" })).toHaveAttribute("aria-selected", "true");
});
