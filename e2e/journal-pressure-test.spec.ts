import { test, expect } from "@playwright/test";

// P5a: protokół próby szczelności jako pole wpisu — w arkuszu przy temacie próby,
// na liście wpisów i w tekście raportu.

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 14, 12, 0).getTime());
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.study.tab.v1", "journal");
    const w = window as unknown as Record<string, unknown>;
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (t: string) => { w.__copied = t; } } });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test("protokół próby: wpis z ciśnieniem, czasem i spadkiem trafia na listę i do raportu", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("button", { name: /^(Wpis|Dokończ wpis)$/ }).click();
  const sheet = page.getByTestId("journal-entry-sheet");

  // Bez tematu próby — tylko po wybraniu tematu.
  await expect(sheet.getByTestId("pressure-test")).toHaveCount(0);
  await sheet.getByRole("button", { name: /^Temat:/ }).click();
  await sheet.getByLabel("Czego dotyczy").selectOption("proba-wody");
  await sheet.getByRole("button", { name: "Dodaj protokół próby szczelności" }).click();
  const proto = sheet.getByTestId("pressure-test");
  await expect(proto.getByRole("radio", { name: "Powietrze" })).toHaveAttribute("aria-checked", "true");
  await expect(proto.getByLabel("Ciśnienie [bar]")).toHaveValue("6");
  await proto.getByRole("radio", { name: "Woda" }).click();
  await proto.getByLabel("Ciśnienie [bar]").fill("9");
  await proto.getByLabel("Czas [min]").fill("30");
  await proto.getByLabel("Spadek [bar]").fill("0,1");
  await sheet.getByLabel("Co się dzieje?").fill("Pion A — próba odbiorowa");
  await sheet.getByRole("button", { name: "Zapisz wpis" }).click();
  await expect(sheet).toHaveCount(0);

  await expect(page.getByTestId("journal-test")).toHaveText("Próba szczelności (woda, 9 bar, 30 min, spadek 0,1 bar): szczelna");

  await page.getByTestId("study-journal").getByRole("button", { name: "Raport" }).click();
  const dialog = page.getByTestId("journal-report");
  await dialog.getByRole("button", { name: "Więcej" }).click();
  await page.getByRole("menuitem", { name: "Kopiuj tekst" }).click();
  const copied = await page.evaluate(() => (window as unknown as { __copied: string }).__copied);
  expect(copied).toContain("Pion A — próba odbiorowa");
  expect(copied).toContain("Próba szczelności (woda, 9 bar, 30 min, spadek 0,1 bar): szczelna");
  // Druk firmowy: protokół przy wpisie, zestawienie prób, miejsca na podpisy.
  await expect(dialog.locator("[data-report-test]")).toHaveCount(1);
  await expect(dialog.locator("[data-report-tests]")).toContainText("woda, 9 bar");
  await expect(dialog.locator("[data-report-signatures]")).toContainText("Wykonawca (podpis)");
});

test("protokół na zalanie (kanalizacja): bez ciśnienia, wynik nieszczelna", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("button", { name: /^(Wpis|Dokończ wpis)$/ }).click();
  const sheet = page.getByTestId("journal-entry-sheet");
  await sheet.getByRole("button", { name: /^Temat:/ }).click();
  await sheet.getByLabel("Czego dotyczy").selectOption("proba-kan");
  await sheet.getByRole("button", { name: "Dodaj protokół próby szczelności" }).click();
  const proto = sheet.getByTestId("pressure-test");
  await expect(proto.getByRole("radio", { name: "Zalanie" })).toHaveAttribute("aria-checked", "true");
  await expect(proto.getByLabel("Ciśnienie [bar]")).toHaveCount(0);
  await proto.getByRole("radio", { name: "Nieszczelna" }).click();
  // Sam protokół (bez tekstu) wystarcza do zapisu wpisu.
  await sheet.getByRole("button", { name: "Zapisz wpis" }).click();
  await expect(page.getByTestId("journal-test")).toHaveText("Próba na zalanie (kanalizacja): nieszczelna");
});
