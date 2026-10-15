import { test, expect } from "@playwright/test";

// Plan UI 2026-10-15, 1.6: szkielet zamiast pustego ekranu przy leniwym widoku
// i pobieranie paczki widoku już przy najechaniu / dotknięciu pozycji nawigacji.
// Service worker zablokowany — inaczej sam pobiera paczki i `page.route` ich nie widzi.
test.use({ serviceWorkers: "block", viewport: { width: 1440, height: 900 } });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
});

test("wolna paczka Grafiku: najpierw szkielet, potem widok", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  await page.route(/\/assets\/ShiftsView-[^/]+\.js$/, async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto("/");
  const nav = page.getByRole("button", { name: "Grafik", exact: true }).first();
  await nav.click();
  const skeleton = page.getByTestId("view-skeleton");
  await expect(skeleton).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Ładowanie grafiku…" })).toHaveCount(1);
  release();
  await expect(skeleton).toHaveCount(0);
});

test("najechanie na „Kalendarz” pobiera paczkę przed kliknięciem", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("button", { name: "Kalendarz", exact: true }).first();
  await expect(nav).toBeVisible();
  const request = page.waitForRequest(/\/assets\/ReminderCalendarView-[^/]+\.js$/);
  await nav.hover();
  await request;
  await expect(page).toHaveURL(/\/$/);
});
