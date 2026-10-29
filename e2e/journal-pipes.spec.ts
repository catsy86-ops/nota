import { test, expect } from "@playwright/test";

// Rury w metrach we wpisie (H1.1): pigułka „Rury” → średnica → metry → zapis; linia na osi dziennika.

test.use({ isMobile: true, hasTouch: true });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 22, 12, 0).getTime());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.study.tab.v1", "journal");
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.study.v1", JSON.stringify({ site: "Lipowa 5", journal: [] }));
  });
});

test("rura w metrach: 3 stuknięcia od arkusza do zapisu, linia na osi, zła liczba z komunikatem @mobile", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("button", { name: /^(Wpis|Dokończ wpis)$/ }).click();
  const sheet = page.getByTestId("journal-entry-sheet");

  await sheet.getByRole("button", { name: "+ Rury" }).click();
  const pipes = sheet.getByTestId("pipes");
  await pipes.getByRole("button", { name: "Rura PEX 16×2" }).click();
  const meters = pipes.getByLabel("Rura PEX 16×2: metry");
  await expect(meters).toBeFocused();

  await meters.fill("24,");
  await expect(pipes.getByRole("alert")).toHaveCount(0);
  await meters.fill("abc");
  await expect(pipes.getByRole("alert")).toHaveText("Wpisz metry jak 24, 24,5 albo 3,75.");
  await meters.fill("24,5");
  await expect(pipes.getByRole("alert")).toHaveCount(0);
  await expect(sheet.getByRole("button", { name: "✓ Rury" })).toBeVisible();

  await sheet.getByRole("button", { name: "Zapisz wpis" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByTestId("journal-pipes").first()).toHaveText("Rura PEX 16×2: 24,5 m");
});
