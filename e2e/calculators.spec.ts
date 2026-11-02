import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

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

  // H6.3: PP i miedź w pojemności (wewn. 13,2 mm i 13 mm).
  await volume.getByLabel("Rura 2", { exact: true }).selectOption("pp20x3.4");
  await expect(volume.getByLabel("Rura 2", { exact: true })).toHaveValue("pp20x3.4");

  // H6.4: wydłużenie — 10 m PEX przy 50 K = 75 mm; zmiana materiału wpisuje jego α.
  const exp = calc.getByRole("region", { name: "Wydłużenie cieplne" });
  await exp.getByLabel("Długość [m]").fill("10");
  await exp.getByLabel("Różnica temp. [K]").fill("50");
  await expect(calc.getByTestId("calc-expansion-result")).toContainText("75mm");
  await exp.getByRole("button", { name: "PP-R stabilizowana (Al)" }).click();
  await expect(exp.getByLabel("α [mm/(m·K)]")).toHaveValue("0,03");
  await expect(calc.getByTestId("calc-expansion-result")).toContainText("15mm");

  // H6.3: ciśnienie — 6 bar = 0,6 MPa = 600 kPa; gwint 1/2″ = DN15.
  const pressure = calc.getByRole("region", { name: "Jednostki ciśnienia" });
  await pressure.getByLabel("Ciśnienie").fill("6");
  await expect(calc.getByTestId("calc-pressure-result")).toContainText("MPa0,6");
  await expect(calc.getByTestId("calc-pressure-result")).toContainText("kPa600");
  await expect(calc.getByTestId("calc-threads").getByRole("row", { name: /^1\/2″/ })).toContainText("15");

  const axe = await new AxeBuilder({ page }).include("[data-testid='calculators']").withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
  expect(axe.violations).toEqual([]);
});

