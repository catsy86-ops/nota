import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// B3.5 Skaner w „Auto”: przyjęcie i liczenie z kodu z opakowania. Pierwszy skan pyta o nazwę, następne ją pamiętają;
// bez natywnego skanera zostaje wpis ręczny. Kamera i `BarcodeDetector` są podstawione (headless nie ma żadnej).
test.use({ permissions: ["camera"], launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] } });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.study.tab.v1", "journal");
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.study.v1", JSON.stringify({ site: "Lipowa 5", journal: [{ id: "a", at: Date.now() - 3600_000, kind: "ok", topic: null, text: "Piony", site: "Lipowa 5", checked: [], images: [] }] }));
  });
  await page.setViewportSize({ width: 390, height: 844 });
});

/** Atrapa detektora: kolejne wywołania zwracają kody z kolejki `window.__codes`. */
async function fakeDetector(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __codes: string[] }).__codes = [];
    (window as unknown as { BarcodeDetector: unknown }).BarcodeDetector = class {
      static async getSupportedFormats() { return ["ean_13", "qr_code"]; }
      async detect() { const c = (window as unknown as { __codes: string[] }).__codes.shift(); return c ? [{ rawValue: c, format: "ean_13" }] : []; }
    };
  });
}
const queue = (page: Page, code: string) => page.evaluate((c) => (window as unknown as { __codes: string[] }).__codes.push(c), code);

async function openVan(page: Page) {
  await page.goto("/praca");
  await page.getByRole("button", { name: "Auto", exact: true }).click();
  return page.getByTestId("van-dialog");
}

async function addItem(van: ReturnType<Page["getByTestId"]>, name: string) {
  const form = van.getByRole("form", { name: "Nowa pozycja w aucie" });
  await form.getByLabel("Nazwa pozycji w aucie").fill(name);
  await form.getByRole("button", { name: "Dodaj" }).click();
}

test("skan przyjęcia: nieznany kod pyta o nazwę raz, następny skan rozpoznaje pozycję", async ({ page }) => {
  await fakeDetector(page);
  const van = await openVan(page);
  await addItem(van, "Kolano 16");

  await queue(page, "5901234567890");
  await van.getByTestId("van-scan-in").click();
  const assign = van.getByTestId("van-assign");
  await expect(assign).toContainText("Nowy kod 5901234567890");
  await expect(page.getByTestId("barcode-scanner")).toHaveCount(0); // zamknął się sam po wykryciu
  const axe = await new AxeBuilder({ page }).include("[data-testid='van-dialog']").withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);

  await assign.getByRole("button", { name: "Kolano 16" }).click();
  await expect(assign).toHaveCount(0);
  await van.getByLabel(/^Przyjęcie: Kolano 16/).fill("10");
  await van.getByRole("button", { name: "Zapisz" }).click();
  await expect(van.getByTestId("van-qty")).toHaveText("10 szt.");
  await expect(van.getByTestId("van-item")).toContainText("5901234567890");

  // Drugi skan tego samego kodu: bez pytania o nazwę, od razu ilość.
  await queue(page, "5901234567890");
  await van.getByTestId("van-scan-in").click();
  await expect(van.getByLabel(/^Przyjęcie: Kolano 16/)).toBeVisible();
  await expect(van.getByTestId("van-assign")).toHaveCount(0);
  await van.getByLabel(/^Przyjęcie: Kolano 16/).fill("5");
  await van.getByRole("button", { name: "Zapisz" }).click();
  await expect(van.getByTestId("van-qty")).toHaveText("15 szt.");

  // Kod zostaje po odświeżeniu (Yjs), więc kolejna sesja też rozpoznaje pozycję.
  await page.reload();
  await page.getByRole("button", { name: "Auto", exact: true }).click();
  await expect(page.getByTestId("van-item")).toContainText("5901234567890");
});

test("skan do liczenia z nową pozycją: nazwa i jednostka z pierwszego skanu", async ({ page }) => {
  await fakeDetector(page);
  const van = await openVan(page);
  await queue(page, "ABC-12345");
  await van.getByTestId("van-scan-count").click();
  const assign = van.getByTestId("van-assign");
  await expect(assign).toContainText("ABC-12345");
  await assign.getByLabel("Nazwa nowej pozycji").fill("Rura PEX 16×2");
  await assign.getByRole("group", { name: "Jednostka nowej pozycji" }).getByRole("button", { name: "m", exact: true }).click();
  await assign.getByRole("button", { name: "Dodaj pozycję" }).click();
  await van.getByLabel(/^Stan teraz: Rura PEX 16×2 \(m\)/).fill("24,5");
  await van.getByRole("button", { name: "Zapisz" }).click();
  await expect(van.getByTestId("van-qty")).toHaveText("24,5 m");
});

test("bez skanera: wpis ręczny ten sam przepływ (a kod ręczny jest czyszczony)", async ({ page }) => {
  const van = await openVan(page);
  await addItem(van, "Trójnik 20");
  await van.getByTestId("van-scan-in").click();
  await expect(page.getByTestId("scanner-fallback")).toContainText("Ta przeglądarka nie ma skanera");
  await page.getByTestId("scanner-manual").fill("  777888  ");
  await page.getByTestId("barcode-scanner").getByRole("button", { name: "Użyj", exact: true }).click();
  await expect(van.getByTestId("van-assign")).toContainText("Nowy kod 777888");
});

test("okno skanera zwalnia kamerę po zamknięciu", async ({ page }) => {
  await fakeDetector(page);
  const van = await openVan(page);
  await van.getByTestId("van-scan-in").click();
  await expect(page.getByTestId("scanner-status")).toHaveText(/Przytrzymaj kod/);
  const live = () => page.evaluate(() => [...document.querySelectorAll("video")].some((v) => (v.srcObject as MediaStream | null)?.getTracks().some((t) => t.readyState === "live")));
  expect(await live()).toBe(true);
  await page.getByTestId("barcode-scanner").getByRole("button", { name: "Zamknij", exact: true }).last().click();
  await expect(page.getByTestId("barcode-scanner")).toHaveCount(0);
  expect(await live()).toBe(false);
});
