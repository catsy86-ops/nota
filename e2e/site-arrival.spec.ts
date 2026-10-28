import { test, expect, type Locator, type Page } from "@playwright/test";

// P2.10: „Jesteś przy budowie” przy otwarciu, gdy włączone. Lokalizację budowy zapisujemy tak jak
// użytkownik: wpis z „Tu jestem” i akcja „Zapisz lokalizację budowy” (jak w journal-geo.spec.ts).
test.use({ permissions: ["geolocation"], geolocation: { latitude: 52.22977, longitude: 21.01178, accuracy: 12 } });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.setViewportSize({ width: 1440, height: 1000 });
});

async function openEntry(page: Page): Promise<Locator> {
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await page.getByRole("button", { name: /^(Wpis|Dokończ wpis)$/ }).click();
  const sheet = page.getByTestId("journal-entry-sheet");
  await expect(sheet).toBeVisible();
  return sheet;
}

test("włączona podpowiedź + przy budowie bez wejścia dziś → dymek „Wchodzę?”", async ({ page }) => {
  // 1) Budowa z lokalizacją: wpis z „Tu jestem” i zapis lokalizacji budowy.
  await page.goto("/praca");
  const sheet = await openEntry(page);
  await sheet.getByRole("button", { name: /^Dodaj budowę$/ }).click();
  await sheet.getByLabel("Inwestycja / adres").fill("Lipowa 5");
  await sheet.getByLabel("Inwestycja / adres").press("Enter");
  await sheet.getByRole("button", { name: "Tu jestem" }).click();
  await expect(sheet.getByTestId("journal-geo")).toContainText("Tu (±12 m)");
  await sheet.getByLabel("Co się dzieje?").fill("Montaż pionu");
  await sheet.getByRole("button", { name: "Zapisz wpis" }).click();
  await page.getByRole("button", { name: "Zapisz lokalizację budowy" }).click();
  await expect(page.getByText("Zapisano lokalizację budowy „Lipowa 5”")).toBeVisible();

  // 2) Włączamy podpowiedź w Ustawieniach (tu: prosto w preferencji) i otwieramy aplikację od nowa.
  await page.evaluate(() => localStorage.setItem("kaczy.study.siteArrival.v1", "true"));
  await page.reload();
  await expect(page.getByText("Jesteś przy budowie „Lipowa 5”")).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Wchodzę" }).click();
  await expect(page.getByText("Zapisano wejście: Lipowa 5")).toBeVisible();
});

test("wyłączona podpowiedź → brak dymku nawet przy budowie", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(2500);
  await expect(page.getByText(/Jesteś przy budowie/)).toHaveCount(0);
});
