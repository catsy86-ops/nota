import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// B3.3 Miarka: wymiary jako dane przy zdjęciu (nie wypalone w obraz). Dwa sposoby: przeciągnięcie i dwa stuknięcia.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.study.tab.v1", "journal");
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
});

async function png(page: Page) {
  const b64 = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 320; c.height = 240;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#6b8"; ctx.fillRect(0, 0, 320, 240);
    return c.toDataURL("image/png").split(",")[1];
  });
  return { name: "rura.png", mimeType: "image/png", buffer: Buffer.from(b64, "base64") };
}

test("wymiary na zdjęciu: przeciągnięcie i dwa stuknięcia, zapis we wpisie, edycja zachowuje", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("button", { name: /^(Wpis|Dokończ wpis)$/ }).click();
  const sheet = page.getByTestId("journal-entry-sheet");
  await sheet.getByLabel("Co się dzieje?").fill("Rura pod płytką");
  await sheet.getByTestId("journal-photo-input").setInputFiles(await png(page));
  await sheet.getByRole("button", { name: "Dodaj wymiary na zdjęciu 1" }).click();

  const drawer = page.getByTestId("dimension-drawer");
  const canvas = drawer.getByTestId("dimension-canvas");
  await expect(canvas).toBeVisible();
  const axe = await new AxeBuilder({ page }).include("[data-testid='dimension-drawer']").withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);

  const box = (await canvas.boundingBox())!;
  const at = (fx: number, fy: number) => ({ x: box.x + box.width * fx, y: box.y + box.height * fy });

  // 1) Przeciągnięcie.
  const a = at(0.2, 0.3), b = at(0.7, 0.3);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, a.y, { steps: 4 });
  await page.mouse.move(b.x, b.y, { steps: 4 });
  await page.mouse.up();
  await drawer.getByLabel("Wymiar", { exact: true }).fill("35 cm od narożnika");
  await drawer.getByRole("button", { name: "Dodaj wymiar" }).click();

  // 2) Dwa stuknięcia (bez przeciągania).
  const c = at(0.3, 0.7), d = at(0.8, 0.7);
  await page.mouse.click(c.x, c.y);
  await expect(drawer.getByTestId("dimension-hint")).toHaveText("Stuknij drugi koniec wymiaru.");
  await page.mouse.click(d.x, d.y);
  await drawer.getByLabel("Wymiar", { exact: true }).fill("120 cm");
  await drawer.getByLabel("Wymiar", { exact: true }).press("Enter");
  await expect(drawer.getByTestId("dimension-item")).toHaveCount(2);

  // Przypadkowe stuknięcie w to samo miejsce nie robi linii.
  await page.mouse.click(at(0.5, 0.5).x, at(0.5, 0.5).y);
  await page.mouse.click(at(0.5, 0.5).x, at(0.5, 0.5).y);
  await expect(drawer.getByLabel("Wymiar", { exact: true })).toHaveCount(0);

  await drawer.getByRole("button", { name: "Zapisz wymiary" }).click();
  await expect(sheet.getByTestId("photo-dimensions")).toHaveText("Zdjęcie 1: wymiary 35 cm od narożnika, 120 cm");
  await expect(sheet.getByRole("button", { name: "Wymiary na zdjęciu 1 (2)" })).toBeVisible();

  await sheet.getByRole("button", { name: "Zapisz wpis" }).click();
  await expect(sheet).toHaveCount(0);
  const entry = page.locator("[data-journal-entry]");
  await expect(entry.getByTestId("journal-sensors")).toContainText("Wymiary na zdjęciach: 2");

  // Edycja: wymiary wracają do miarki, usunięcie jednego zostaje po zapisie.
  await entry.getByRole("button", { name: "Opcje wpisu" }).click();
  await page.getByRole("menuitem", { name: "Edytuj wpis" }).click();
  await sheet.getByRole("button", { name: "Wymiary na zdjęciu 1 (2)" }).click();
  await expect(drawer.getByTestId("dimension-item")).toHaveCount(2);
  await drawer.getByRole("button", { name: "Usuń wymiar 120 cm" }).click();
  await drawer.getByRole("button", { name: "Zapisz wymiary" }).click();
  await sheet.getByRole("button", { name: "Zapisz zmiany" }).click();
  await expect(entry.getByTestId("journal-sensors")).toContainText("Wymiary na zdjęciach: 1");
});

test.describe("telefon", () => {
  test.use({ isMobile: true, hasTouch: true });

  test("miarka na 390 px: okno mieści się, przyciski mają cel dotyku ≥ 44 px, wymiar dodany stuknięciem @mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/praca");
    await page.getByRole("button", { name: /^(Wpis|Dokończ wpis)$/ }).click();
    const sheet = page.getByTestId("journal-entry-sheet");
    await sheet.getByLabel("Co się dzieje?").fill("Kotłownia");
    await sheet.getByTestId("journal-photo-input").setInputFiles(await png(page));
    await sheet.getByRole("button", { name: "Dodaj wymiary na zdjęciu 1" }).click();

    const drawer = page.getByTestId("dimension-drawer");
    const canvas = drawer.getByTestId("dimension-canvas");
    await expect(canvas).toBeVisible();
    await expect.poll(async () => { const b = await drawer.boundingBox(); return b ? Math.round(b.x) >= 0 && Math.round(b.x + b.width) <= 390 : false; }).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    const box = (await canvas.boundingBox())!;
    await canvas.tap({ position: { x: box.width * 0.2, y: box.height * 0.5 } });
    await expect(drawer.getByTestId("dimension-hint")).toHaveText("Stuknij drugi koniec wymiaru.");
    await canvas.tap({ position: { x: box.width * 0.8, y: box.height * 0.5 } });
    await drawer.getByLabel("Wymiar", { exact: true }).fill("2,5 m");
    for (const name of ["Dodaj wymiar", "Anuluj", "Zapisz wymiary"]) {
      const b = await drawer.getByRole("button", { name }).boundingBox();
      expect(b!.height, name).toBeGreaterThanOrEqual(43.5);
    }
    await drawer.getByRole("button", { name: "Dodaj wymiar" }).click();
    await expect(drawer.getByTestId("dimension-item")).toHaveText(/2,5 m/);
  });
});

test("zdjęcie pionowe: wymiar zapisuje się względem obrazu, nie ramki płótna (audyt UI #1)", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("button", { name: /^(Wpis|Dokończ wpis)$/ }).click();
  const sheet = page.getByTestId("journal-entry-sheet");
  await sheet.getByLabel("Co się dzieje?").fill("Pion");
  // Pionowe 3:4: przy szerokości okna wysokość przekracza limit 50 dvh, więc obraz ma puste pasy po bokach.
  const b64 = await page.evaluate(() => { const c = document.createElement("canvas"); c.width = 240; c.height = 320; c.getContext("2d")!.fillRect(0, 0, 240, 320); return c.toDataURL("image/png").split(",")[1]; });
  await sheet.getByTestId("journal-photo-input").setInputFiles({ name: "pion.png", mimeType: "image/png", buffer: Buffer.from(b64, "base64") });
  await sheet.getByRole("button", { name: "Dodaj wymiary na zdjęciu 1" }).click();
  const drawer = page.getByTestId("dimension-drawer");
  const canvas = drawer.getByTestId("dimension-canvas");
  await expect(canvas).toBeVisible();
  await expect.poll(() => canvas.evaluate((c: HTMLCanvasElement) => c.width)).toBeGreaterThan(0);

  // Układ ustala się po załadowaniu obrazu (płótno zmienia rozmiar) — czekamy, aż prostokąt przestanie się zmieniać.
  await expect.poll(async () => { const a = await canvas.boundingBox(); await page.waitForTimeout(150); const b = await canvas.boundingBox(); return JSON.stringify(a) === JSON.stringify(b); }).toBe(true);

  // Prostokąt samego obrazu wewnątrz ramki (object-contain).
  const rect = await canvas.evaluate((c: HTMLCanvasElement) => {
    const r = c.getBoundingClientRect();
    const scale = Math.min(r.width / c.width, r.height / c.height);
    const w = c.width * scale, h = c.height * scale;
    return { x: r.left + (r.width - w) / 2, y: r.top + (r.height - h) / 2, w, h, frameW: r.width };
  });
  expect(rect.frameW - rect.w, "obraz ma puste pasy po bokach").toBeGreaterThan(20);

  // Stuknięcia w 25% i 75% szerokości OBRAZU na wysokości 50%.
  await page.mouse.click(rect.x + rect.w * 0.25, rect.y + rect.h * 0.5);
  await page.mouse.click(rect.x + rect.w * 0.75, rect.y + rect.h * 0.5);
  await drawer.getByLabel("Wymiar", { exact: true }).fill("1 m");
  await drawer.getByLabel("Wymiar", { exact: true }).press("Enter");
  await drawer.getByRole("button", { name: "Zapisz wymiary" }).click();

  const dims = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem("kaczy.study.draft.v1") ?? "{}").dimensions ?? {})[0] as Array<{ from: number[]; to: number[] }>);
  expect(dims[0].from[0]).toBeCloseTo(0.25, 1);
  expect(dims[0].to[0]).toBeCloseTo(0.75, 1);
  expect(dims[0].from[1]).toBeCloseTo(0.5, 1);
});
