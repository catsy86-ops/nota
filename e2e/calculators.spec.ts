import { test, expect } from "@playwright/test";

// Kalkulatory na budowę: spadek (w obie strony), próba wodna, pojemność kilku odcinków.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.study.tab.v1", "quiz");
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test("kalkulatory: spadek, próba wodna i pojemność instalacji", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("button", { name: "Kalkulatory" }).click();
  const calc = page.getByTestId("calculators");

  // Spadek → różnica wysokości: 8 m przy 2% = 16 cm; szybki spadek 2,5% = 20 cm.
  const slope = calc.getByRole("region", { name: "Spadek kanalizacji" });
  await slope.getByLabel("Długość [m]").fill("8");
  await expect(calc.getByTestId("calc-slope-result")).toContainText("16cm");
  await slope.getByRole("button", { name: "2,5%" }).click();
  await expect(calc.getByTestId("calc-slope-result")).toContainText("20cm");

  // Różnica wysokości → spadek: 10 cm na 8 m = 1,25% — poniżej typowych 2–3%.
  await slope.getByRole("button", { name: "Spadek w %" }).click();
  await slope.getByLabel("Różnica wysokości [cm]").fill("10");
  await expect(calc.getByTestId("calc-slope-result")).toContainText("1,25%");
  await expect(slope.getByRole("note")).toContainText("Mniej niż typowe 2–3%");

  // Próba wodna: 4 bar robocze → 6 bar próbne, manometr co najmniej 9 bar.
  const water = calc.getByRole("region", { name: "Próba wodna" });
  await water.getByLabel("Ciśnienie robocze [bar]").fill("4");
  await expect(calc.getByTestId("calc-test-result")).toContainText("6bar");
  await expect(calc.getByTestId("calc-gauge-result")).toContainText("9bar");

  // Pojemność: 10 m 16×2 (1,13 l) + 5 m 20×2 (1,01 l) = 2,14 l.
  const volume = calc.getByRole("region", { name: "Pojemność instalacji" });
  await volume.getByLabel("Rura 1: długość").fill("10");
  await expect(calc.getByTestId("calc-volume-total")).toContainText("1,13l");
  await volume.getByRole("button", { name: "Kolejny odcinek" }).click();
  await volume.getByLabel("Rura 2", { exact: true }).selectOption("20x2");
  await volume.getByLabel("Rura 2: długość").fill("5,0");
  await expect(calc.getByTestId("calc-volume-total")).toContainText("2,14l");
});
