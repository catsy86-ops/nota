import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";

// B4.3 Kilometrówka: trasa z budów, podpowiedź km z lokalizacji, suma miesiąca, „Cofnij”, CSV dla księgowej.

test.use({ permissions: ["geolocation"] });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.setViewportSize({ width: 1440, height: 1000 });
});

/** Wpis z „Tu jestem” i zapisem lokalizacji budowy — tak budowa dostaje `geo` (jak w journal-geo.spec.ts). */
async function siteAt(page: import("@playwright/test").Page, name: string, lat: number, lng: number) {
  // Przeglądarka cache'uje pozycję (maximumAge 60 s), więc zwracamy współrzędne wprost.
  await page.evaluate(([la, lo]) => {
    navigator.geolocation.getCurrentPosition = (ok) => ok({ coords: { latitude: la, longitude: lo, accuracy: 10 } } as GeolocationPosition);
  }, [lat, lng]);
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await page.getByRole("button", { name: /^(Wpis|Dokończ wpis)$/ }).click();
  const sheet = page.getByTestId("journal-entry-sheet");
  await sheet.getByRole("button", { name: /^(Dodaj budowę|Budowa: .*\. Zmień)$/ }).click();
  await sheet.getByLabel("Inwestycja / adres").fill(name);
  await sheet.getByLabel("Inwestycja / adres").press("Enter");
  await sheet.getByRole("button", { name: "Tu jestem" }).click();
  await expect(sheet.getByTestId("journal-geo")).toBeVisible();
  await sheet.getByLabel("Co się dzieje?").fill("Piony");
  await sheet.getByRole("button", { name: "Zapisz wpis" }).click();
  await expect(sheet).toHaveCount(0);
  await page.getByRole("button", { name: "Zapisz lokalizację budowy" }).click();
  await expect(page.getByText(`Zapisano lokalizację budowy „${name}”`)).toBeVisible();
}

test("kilometrówka: podpowiedź z lokalizacji, zapis, suma, cofnięcie usunięcia i CSV", async ({ page }) => {
  await page.goto("/praca");
  await siteAt(page, "Lipowa 5", 52, 21);
  await siteAt(page, "Kwiatowa 2", 52, 21.1);
  await page.getByTestId("mileage-open").click();
  const dialog = page.getByTestId("mileage-dialog");
  await expect(dialog.getByText("Brak przejazdów w tym miesiącu.")).toBeVisible();
  const axe = await new AxeBuilder({ page }).include('[data-testid="mileage-dialog"]').withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);

  await dialog.getByRole("button", { name: "Lipowa 5", exact: true }).click();
  await expect(dialog.getByTestId("mileage-suggest")).toHaveCount(0); // jedna budowa = brak trasy
  await dialog.getByRole("button", { name: "Kwiatowa 2", exact: true }).click();
  await expect(dialog.getByTestId("mileage-suggest")).toContainText("około 8,8 km");
  await dialog.getByRole("button", { name: "Wpisz", exact: true }).click();
  await expect(dialog.getByLabel("Kilometry (z licznika)")).toHaveValue("8,8");

  // Zła wartość nie zapisuje; poprawna tak.
  await dialog.getByLabel("Kilometry (z licznika)").fill("abc");
  await dialog.getByRole("button", { name: "Dodaj przejazd" }).click();
  await expect(page.getByText(/Kilometry: wpisz liczbę/)).toBeVisible();
  await dialog.getByLabel("Kilometry (z licznika)").fill("10");
  await dialog.getByLabel("Stawka za km (zł)").fill("1");
  await dialog.getByRole("button", { name: "Dodaj przejazd" }).click();

  const row = dialog.getByTestId("mileage-entry");
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("Lipowa 5 → Kwiatowa 2");
  await expect(dialog.getByTestId("mileage-total")).toContainText("10 km · 10 zł");

  // Po odświeżeniu przejazd zostaje (magazyn na urządzeniu), a stawka jest zapamiętana.
  await page.reload();
  await page.getByTestId("mileage-open").click();
  await expect(dialog.getByTestId("mileage-entry")).toHaveCount(1);
  await expect(dialog.getByLabel("Stawka za km (zł)")).toHaveValue("1");

  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Pobierz CSV" }).click();
  const file = await readFile(await (await download).path());
  const csv = file.toString("utf8");
  expect(csv.charCodeAt(0)).toBe(0xfeff);
  expect(csv).toContain("Lipowa 5 → Kwiatowa 2;2;10;1;10,00");
  expect(csv).toContain("Razem;;;10;;10,00");

  await dialog.getByRole("button", { name: /^Usuń przejazd 10 km/ }).click();
  await expect(dialog.getByTestId("mileage-entry")).toHaveCount(0);
  await page.getByRole("button", { name: "Cofnij" }).click();
  await expect(dialog.getByTestId("mileage-entry")).toHaveCount(1);
});

test.describe("telefon", () => {
  test.use({ isMobile: true, hasTouch: true });

  test("kilometrówka na telefonie: okno mieści się w 390 px, cele dotyku ≥ 44 px @mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/praca");
    await siteAt(page, "Lipowa 5", 52, 21);
    const dialog = page.getByTestId("mileage-dialog");
    // Zaraz po zapisie wpisu strona jeszcze się układa i pierwszy klik bywa połknięty.
    await expect(async () => {
      if (!(await dialog.isVisible())) await page.getByTestId("mileage-open").click();
      await expect(dialog).toBeVisible({ timeout: 1500 });
    }).toPass();
    // Okno wjeżdża animacją — mierzymy dopiero po jej końcu.
    await expect.poll(async () => { const b = await dialog.boundingBox(); return b ? Math.round(b.x) >= 0 && Math.round(b.x + b.width) <= 390 : false; }).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    for (const name of ["Poprzedni miesiąc", "Następny miesiąc", "Dodaj przejazd"]) {
      const b = await dialog.getByRole("button", { name }).boundingBox();
      expect(b!.height, name).toBeGreaterThanOrEqual(43.5);
    }
    const chip = await dialog.getByRole("button", { name: "Lipowa 5", exact: true }).boundingBox();
    expect(chip!.height).toBeGreaterThanOrEqual(43.5);
  });
});
