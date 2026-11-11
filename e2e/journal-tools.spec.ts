import { test, expect, type Page } from "@playwright/test";

// Faza 3: pigułki „Dodaj do wpisu” otwierają skaner kodu (B3.5), NFC (B3.11), streszczenie AI (B3.6) i poziomicę (B3.4).
// Wcześniej bloki tych narzędzi pojawiały się dopiero po ustawieniu wartości, której nic nie mogło ustawić —
// funkcje były nieosiągalne. Telefon (dotyk) jest emulowany, a kamera, NDEFReader i Summarizer podstawione.
test.use({
  isMobile: true, hasTouch: true, permissions: ["camera"],
  launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.study.tab.v1", "journal");
    const w = window as unknown as Record<string, unknown>;
    w.__codes = [];
    w.BarcodeDetector = class {
      static async getSupportedFormats() { return ["ean_13", "qr_code"]; }
      async detect() { const c = (w.__codes as string[]).shift(); return c ? [{ rawValue: c, format: "ean_13" }] : []; }
    };
    w.NDEFReader = class {
      onreading: ((e: unknown) => void) | null = null;
      onreadingerror: (() => void) | null = null;
      async scan() { setTimeout(() => this.onreading?.({ serialNumber: "04:A1:B2:C3", message: { records: [] } }), 50); }
    };
    w.Summarizer = {
      availability: async () => "available",
      create: async () => ({ summarize: async (t: string) => `Skrót: ${t.slice(0, 20)}`, destroy() {} }),
    };
  });
  await page.setViewportSize({ width: 390, height: 844 });
});

async function openSheet(page: Page) {
  await page.goto("/praca");
  await page.getByRole("button", { name: /^(Wpis|Dokończ wpis)$/ }).click();
  const sheet = page.getByTestId("journal-entry-sheet");
  await sheet.getByLabel("Co się dzieje?").fill("Montaż pionu w łazience, sprawdzony spadek");
  return sheet;
}

test("kod: pigułka otwiera skaner, wykryty kod czeka na „Użyj” i trafia do wpisu i na listę", async ({ page }) => {
  const sheet = await openSheet(page);
  await page.evaluate(() => (window as unknown as { __codes: string[] }).__codes.push("5901234567890"));
  await sheet.getByTestId("pill-barcode").click();
  const scanner = page.getByTestId("barcode-scanner");
  await expect(scanner.getByTestId("scanner-code")).toContainText("5901234567890");
  await scanner.getByRole("button", { name: "Użyj", exact: true }).last().click();
  await expect(sheet.getByRole("button", { name: "Kod: 5901234567890" })).toBeVisible();
  await expect(sheet.getByTestId("pill-barcode")).toContainText("✓");

  await sheet.getByRole("button", { name: "Zapisz wpis" }).click();
  await expect(page.locator("[data-journal-entry]").getByTestId("journal-sensors")).toContainText("Kod: 5901234567890");
});

test("NFC: pigułka otwiera odczyt, numer seryjny tagu trafia do pola kodu", async ({ page }) => {
  const sheet = await openSheet(page);
  await sheet.getByTestId("pill-nfc").click();
  const nfc = page.getByTestId("nfc-reader");
  await expect(nfc).toContainText("04:A1:B2:C3");
  await nfc.getByRole("button", { name: "Użyj", exact: true }).click();
  await expect(sheet.getByRole("button", { name: "Kod: 04:A1:B2:C3" })).toBeVisible();
});

test("streszczenie AI: pigułka, wynik do edycji, zapis na liście", async ({ page }) => {
  const sheet = await openSheet(page);
  await sheet.getByTestId("pill-ai").click();
  const ai = page.getByRole("dialog").filter({ hasText: "Skrót: Montaż pionu w łaz" });
  await expect(ai).toBeVisible();
  await ai.getByRole("button", { name: /^Użyj/ }).click();
  await expect(sheet.getByRole("button", { name: /Streszczenie: Skrót: Montaż pionu/ })).toBeVisible();
  await sheet.getByRole("button", { name: "Zapisz wpis" }).click();
  await expect(page.locator("[data-journal-entry]").getByTestId("journal-summary")).toContainText("Skrót: Montaż pionu w łaz");
});

test("spadek: pigułka, zgoda czujnika z kliknięcia, kalibracja, strefa 2–3% i zapis w % na liście", async ({ page }) => {
  // Jak na iPhonie: zgodę da się uzyskać tylko z kliknięcia.
  await page.addInitScript(() => { (DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission = async () => "granted"; });
  const sheet = await openSheet(page);
  await sheet.getByTestId("pill-level").click();
  const meter = page.getByTestId("level-meter");
  await expect(meter.getByTestId("level-enable")).toBeVisible();
  await meter.getByTestId("level-enable").click();
  const tilt = (beta: number) => page.evaluate((b) => { for (let i = 0; i < 30; i++) window.dispatchEvent(new DeviceOrientationEvent("deviceorientation", { beta: b, gamma: 0, alpha: 0 })); }, beta);

  // Telefon leży płasko (odczyt 0,6° przez krzywy stół) → kalibracja robi z tego zero.
  await tilt(0.6);
  await expect(meter.getByTestId("level-calibrate")).toBeEnabled();
  await meter.getByTestId("level-calibrate").click();
  await tilt(0.6 + 0.3);
  await expect(meter.getByTestId("level-percent")).toHaveText("0,5%");
  await expect(meter.getByTestId("level-angle")).toContainText("poza zakresem 2–3%");

  // 1,3° ≈ 2,3% → strefa „w normie”.
  await tilt(0.6 + 1.3);
  await expect(meter.getByTestId("level-percent")).toHaveText("2,3%");
  await expect(meter.getByTestId("level-angle")).toContainText("w normie");
  await meter.getByTestId("level-save").click();
  await expect(sheet.getByTestId("pill-level")).toContainText("✓");
  await expect(sheet.getByRole("button", { name: /^Spadek: 2,3%/ })).toBeVisible();
  await sheet.getByRole("button", { name: "Zapisz wpis" }).click();
  await expect(page.locator("[data-journal-entry]").getByTestId("journal-sensors")).toContainText("Spadek 2,3% (1,3°)");
});

test("spadek: bez czujnika (komputer) okno mówi o tym zamiast pokazywać zero", async ({ page }) => {
  const sheet = await openSheet(page);
  await sheet.getByTestId("pill-level").click();
  // Przeglądarki z `requestPermission` najpierw proszą o kliknięcie; bez zdarzeń z czujnika okno kończy komunikatem.
  const enable = page.getByTestId("level-enable");
  if (await enable.isVisible()) await enable.click();
  await expect(page.getByTestId("level-blocked")).toBeVisible({ timeout: 8000 });
  await expect(page.getByTestId("level-save")).toBeDisabled();
});

test("bez API narzędzia nie wystają: brak pigułek NFC i AI, kod zostaje (wpis ręczny)", async ({ page }) => {
  await page.addInitScript(() => { const w = window as unknown as Record<string, unknown>; delete w.NDEFReader; delete w.Summarizer; delete w.BarcodeDetector; });
  const sheet = await openSheet(page);
  await expect(sheet.getByTestId("pill-nfc")).toHaveCount(0);
  await expect(sheet.getByTestId("pill-ai")).toHaveCount(0);
  await sheet.getByTestId("pill-barcode").click();
  await expect(page.getByTestId("scanner-fallback")).toBeVisible();
});
