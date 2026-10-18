import { test, expect, type Locator, type Page } from "@playwright/test";

// „Tu jestem”: lokalizacja wpisu tylko po stuknięciu, zapis lokalizacji budowy i podpowiedź „Budowa obok”.
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

async function setSite(sheet: Locator, name: string) {
  await sheet.getByRole("button", { name: /^(Dodaj budowę|Budowa: .*\. Zmień)$/ }).click();
  await sheet.getByLabel("Inwestycja / adres").fill(name);
  await sheet.getByLabel("Inwestycja / adres").press("Enter");
  await expect(sheet.getByRole("button", { name: `Budowa: ${name}. Zmień` })).toBeVisible();
}

test("Tu jestem: lokalizacja wpisu, zapis lokalizacji budowy i podpowiedź budowy obok", async ({ page }) => {
  await page.goto("/praca");
  let sheet = await openEntry(page);
  await setSite(sheet, "Lipowa 5");

  // Bez stuknięcia nie ma lokalizacji.
  await expect(sheet.getByTestId("journal-geo")).toHaveCount(0);
  await sheet.getByRole("button", { name: "Tu jestem" }).click();
  await expect(sheet.getByTestId("journal-geo")).toContainText("Tu (±12 m)");

  await sheet.getByLabel("Co się dzieje?").fill("Montaż pionu w łazience");
  await sheet.getByRole("button", { name: "Zapisz wpis" }).click();
  await expect(sheet).toHaveCount(0);
  // Nowa budowa ma kartę dopiero po zapisie — lokalizację budowy zapisuje akcja w toaście.
  await page.getByRole("button", { name: "Zapisz lokalizację budowy" }).click();
  await expect(page.getByText("Zapisano lokalizację budowy „Lipowa 5”")).toBeVisible();
  await expect(page.getByTestId("journal-entry-geo")).toHaveAttribute("href", /maps.*52\.22977,21\.01178/);

  // Następny wpis z inną budową w polu: lokalizacja podpowiada tę obok.
  sheet = await openEntry(page);
  await setSite(sheet, "Inna budowa");
  await sheet.getByRole("button", { name: "Tu jestem" }).click();
  await sheet.getByTestId("journal-nearby-site").click();
  await expect(sheet.getByRole("button", { name: "Budowa: Lipowa 5. Zmień" })).toBeVisible();
});

test("Tu jestem: brak zgody na lokalizację daje jasny komunikat", async ({ page, context }) => {
  await context.clearPermissions();
  await page.goto("/praca");
  const sheet = await openEntry(page);
  await sheet.getByRole("button", { name: "Tu jestem" }).click();
  await expect(page.getByText(/Brak zgody na lokalizację|Nie udało się ustalić lokalizacji/)).toBeVisible();
  await expect(sheet.getByTestId("journal-geo")).toHaveCount(0);
});
