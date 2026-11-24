import { test, expect } from "@playwright/test";

// „Zacznij dzień” (R2.5): wybór budowy, godzina wejścia, plan na dziś, zapis wejścia.

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 14, 7, 20).getTime());
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      site: "Lipowa 5",
      journal: [
        { id: "a", at: new Date(2026, 9, 13, 15, 10).getTime(), kind: "ok", topic: null, text: "Pion kanalizacji", site: "Lipowa 5", checked: [], images: [] },
      ],
    }));
  });
  await page.setViewportSize({ width: 390, height: 844 });
});

test("wybór budowy i godziny, „Wchodzę” zapisuje wejście i zamyka arkusz", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await page.getByTestId("start-day-open").click();
  const sheet = page.getByTestId("start-day");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByTestId("start-day-sites").getByRole("button", { name: /Lipowa 5/ })).toHaveAttribute("aria-pressed", "true");
  await expect(sheet.getByTestId("start-day-time")).toHaveValue("07:20");
  await expect(sheet.getByTestId("start-day-plan")).toContainText("Brak zadań na dziś");

  await sheet.getByTestId("start-day-time").fill("07:05");
  await sheet.getByTestId("start-day-enter").click();
  await expect(sheet).toHaveCount(0);
});

test("zła godzina blokuje „Wchodzę”", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await page.getByTestId("start-day-open").click();
  const sheet = page.getByTestId("start-day");
  await sheet.getByTestId("start-day-time").fill("");
  await expect(sheet.getByTestId("start-day-enter")).toBeDisabled();
});
