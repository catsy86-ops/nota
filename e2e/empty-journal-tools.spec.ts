import { test, expect } from "@playwright/test";

// Audyt UI #4: Auto i Kilometrówka nie zależą od wpisów dziennika, więc nie mogą znikać przy pustym dzienniku.
test("pusty dziennik: Auto i Kilometrówka są dostępne od razu", async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem("kaczy.tour.seen.v1", "1"); localStorage.setItem("kaczy.study.tab.v1", "journal"); });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/praca");
  await expect(page.getByText("Brak wpisów")).toBeVisible();
  await page.getByTestId("mileage-open-empty").click();
  await expect(page.getByTestId("mileage-dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByTestId("van-open-empty").click();
  await expect(page.getByTestId("van-dialog")).toBeVisible();
});
