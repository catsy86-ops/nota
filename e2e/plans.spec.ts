import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";

// Analizator planów (faza 2): dział /plany, import zrzutu z walidacją, edytor z zoomem i dopasowaniem,
// adres `?analiza=`, usunięcie z „Cofnij”.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.setViewportSize({ width: 1280, height: 900 });
});

/** PNG „planu”: białe tło, siatka i kilka kolorowych linii — narysowany w przeglądarce. */
async function planPng(page: Page, w = 1600, h = 900): Promise<Buffer> {
  const b64 = await page.evaluate(([w, h]) => {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#999"; ctx.lineWidth = 2;
    for (let x = 0; x < w; x += 200) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    ctx.strokeStyle = "#1565c0"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(100, 100); ctx.lineTo(1400, 100); ctx.lineTo(1400, 800); ctx.stroke();
    ctx.fillStyle = "#000"; ctx.font = "28px sans-serif"; ctx.fillText("Ø16 ZW", 600, 90);
    return c.toDataURL("image/png").split(",")[1];
  }, [w, h]);
  return Buffer.from(b64, "base64");
}

test("Plany: import zrzutu, edytor z zoomem, odświeżenie, powrót i usunięcie z „Cofnij”", async ({ page }) => {
  await page.goto("/plany");
  const list = page.getByTestId("plans-list");
  await expect(list.getByText("Brak analiz")).toBeVisible();

  await list.getByRole("button", { name: "Nowa analiza" }).click();
  const dialog = page.getByTestId("plan-new");
  // Plik, który nie jest obrazem (SVG ze skryptem) — czytelny błąd, nic nie powstaje.
  await dialog.getByTestId("plan-file").setInputFiles({ name: "plan.png", mimeType: "image/png", buffer: Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>") });
  await expect(dialog.getByRole("alert")).toContainText("To nie jest obraz PNG, JPG ani WebP");
  await expect(dialog.getByRole("button", { name: "Utwórz analizę" })).toBeDisabled();

  await dialog.getByTestId("plan-file").setInputFiles({ name: "Parter wod-kan.png", mimeType: "image/png", buffer: await planPng(page) });
  await expect(dialog.getByRole("img", { name: "Podgląd planu" })).toBeVisible();
  await expect(dialog.getByText("1600×900 px")).toBeVisible();
  await expect(dialog.getByLabel("Nazwa analizy")).toHaveValue("Parter wod-kan");
  const axe = await new AxeBuilder({ page }).include("[data-testid='plan-new']").withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
  expect(axe.violations).toEqual([]);
  await dialog.getByRole("button", { name: "Utwórz analizę" }).click();

  const editor = page.getByTestId("plan-editor");
  await expect(editor.getByRole("heading", { name: "Parter wod-kan" })).toBeVisible();
  await expect(page).toHaveURL(/\/plany\?analiza=plan-/);
  const canvas = editor.getByTestId("plan-canvas");
  await expect(canvas).toHaveAttribute("data-scale", /\d/);
  const fitted = Number(await canvas.getAttribute("data-scale"));
  await editor.getByRole("button", { name: "Przybliż" }).click();
  await expect.poll(async () => Number(await canvas.getAttribute("data-scale"))).toBeCloseTo(fitted * 1.25, 3);
  await canvas.focus();
  await page.keyboard.press("-");
  await page.keyboard.press("-");
  await expect.poll(async () => Number(await canvas.getAttribute("data-scale"))).toBeLessThan(fitted);
  await editor.getByRole("button", { name: "Dopasuj do ekranu" }).click();
  await expect.poll(async () => Number(await canvas.getAttribute("data-scale"))).toBeCloseTo(fitted, 3);

  // Odświeżenie zostaje w edytorze (dane z IndexedDB, obraz z magazynu).
  await page.reload();
  await expect(page.getByTestId("plan-editor").getByRole("heading", { name: "Parter wod-kan" })).toBeVisible();
  await expect(page.locator("[data-testid='plan-canvas'] image")).toHaveAttribute("href", /^blob:/);

  await page.getByRole("button", { name: "Wróć do listy analiz" }).click();
  await expect(page).toHaveURL(/\/plany$/);
  await expect(list.getByText("1 analiza")).toBeVisible();
  await expect(list.getByText(/0 tras · bez skali/)).toBeVisible();
  const axeList = await new AxeBuilder({ page }).include("[data-testid='plans-view']").withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
  expect(axeList.violations).toEqual([]);

  await list.getByRole("button", { name: "Usuń analizę Parter wod-kan" }).click();
  await expect(list.getByText("Brak analiz")).toBeVisible();
  await page.getByRole("button", { name: "Cofnij" }).click();
  await expect(list.getByText("1 analiza")).toBeVisible();
});

test("Plany: dział jest w pasku bocznym, „wstecz” z edytora wraca do listy", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("complementary").getByRole("button", { name: "Plany", exact: true }).click();
  await expect(page).toHaveURL(/\/plany$/);
  await page.getByTestId("plans-list").getByRole("button", { name: "Nowa analiza" }).click();
  await page.getByTestId("plan-new").getByTestId("plan-file").setInputFiles({ name: "a.png", mimeType: "image/png", buffer: await planPng(page, 400, 300) });
  await page.getByTestId("plan-new").getByRole("button", { name: "Utwórz analizę" }).click();
  await expect(page.getByTestId("plan-editor")).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId("plans-list")).toBeVisible();
  await expect(page).toHaveURL(/\/plany$/);
});

/** Klik w punkt obrazu (piksele oryginału) — przeliczenie przez widok z atrybutów płótna. */
async function clickImage(page: Page, x: number, y: number) {
  const canvas = page.getByTestId("plan-canvas");
  const box = (await canvas.boundingBox())!;
  const [s, tx, ty] = await Promise.all(["data-scale", "data-tx", "data-ty"].map(async (a) => Number(await canvas.getAttribute(a))));
  await page.mouse.click(box.x + tx + x * s, box.y + ty + y * s);
}

async function newPlan(page: Page, name: string) {
  await page.goto("/plany");
  await page.getByTestId("plans-list").getByRole("button", { name: "Nowa analiza" }).click();
  const dialog = page.getByTestId("plan-new");
  await dialog.getByTestId("plan-file").setInputFiles({ name: `${name}.png`, mimeType: "image/png", buffer: await planPng(page) });
  await dialog.getByRole("button", { name: "Utwórz analizę" }).click();
  await expect(page.getByTestId("plan-canvas")).toHaveAttribute("data-tx", /\d/);
}

test("Plany (faza 3): trasa bez skali w pikselach, kalibracja daje metry, średnica, przeciąganie punktu, usuwanie i „Cofnij”", async ({ page }) => {
  await newPlan(page, "Trasy");
  const editor = page.getByTestId("plan-editor");

  // Trasa 100,100 → 1400,100 → 1400,800 = 1300 + 700 = 2000 px.
  await editor.getByRole("button", { name: "Trasa", exact: true }).click();
  await clickImage(page, 100, 100);
  await clickImage(page, 1400, 100);
  await clickImage(page, 1400, 800);
  const draftLen = editor.getByTestId("plan-draft-length");
  await expect(draftLen).toHaveText(/^(199\d|200\d) px \(bez skali\)$/);
  await editor.getByRole("button", { name: "Zakończ trasę" }).click();
  const routeLen = editor.getByTestId("plan-route-length");
  await expect(routeLen).toContainText("bez skali");

  // Skala: odcinek 0,0 → 1000,0 to 5 m, więc 2000 px = 10 m.
  await editor.getByRole("button", { name: "Skala", exact: true }).click();
  await clickImage(page, 0, 450);
  await clickImage(page, 1000, 450);
  await editor.getByLabel("Długość w metrach").fill("5");
  await editor.getByRole("button", { name: "Zapisz skalę" }).click();
  await expect(editor.getByTestId("plan-scale")).toContainText(/1 m = (19\d|20\d)/);

  // Zaznaczenie stuknięciem w trasę, średnica i długość w metrach.
  await clickImage(page, 700, 100);
  await expect(routeLen).toHaveText(/^(9,9\d|10,0\d) m$/);
  await editor.getByLabel("Średnica (mm)").fill("16");
  await editor.getByLabel("Średnica (mm)").press("Enter");
  await expect(editor.getByTestId("plan-routes")).toContainText("Ø16");

  // Przeciągnięcie ostatniego punktu 1400,800 → 1400,450: trasa krótsza o 350 px (1,75 m).
  const canvas = page.getByTestId("plan-canvas");
  const box = (await canvas.boundingBox())!;
  const [s, tx, ty] = await Promise.all(["data-scale", "data-tx", "data-ty"].map(async (a) => Number(await canvas.getAttribute(a))));
  await page.mouse.move(box.x + tx + 1400 * s, box.y + ty + 800 * s);
  await page.mouse.down();
  await page.mouse.move(box.x + tx + 1400 * s, box.y + ty + 600 * s, { steps: 5 });
  await page.mouse.move(box.x + tx + 1400 * s, box.y + ty + 450 * s, { steps: 5 });
  await page.mouse.up();
  await expect(routeLen).toHaveText(/^8,2\d m$/);

  // „Cofnij” z paska (i Ctrl+Z) wraca do poprzedniego przebiegu.
  await editor.getByRole("button", { name: "Cofnij", exact: true }).click();
  await expect(routeLen).toHaveText(/^(9,9\d|10,0\d) m$/);

  await editor.getByRole("button", { name: "Usuń trasę" }).click();
  await expect(editor.getByTestId("plan-routes")).toContainText("Brak tras");
  await page.getByRole("button", { name: "Cofnij" }).last().click();
  await expect(editor.getByTestId("plan-routes")).toContainText("Ø16");

  // Po odświeżeniu: trasa i skala zostają.
  await page.reload();
  await expect(page.getByTestId("plan-routes")).toContainText(/Ø16.*(9,9\d|10,0\d) m/);
  const axe = await new AxeBuilder({ page }).include("[data-testid='plan-editor']").withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
  expect(axe.violations).toEqual([]);
});

test("Plany (faza 3): trasa z klawiatury — spacja w celowniku, Enter kończy", async ({ page }) => {
  await newPlan(page, "Klawiatura");
  const editor = page.getByTestId("plan-editor");
  await editor.getByRole("button", { name: "Trasa", exact: true }).click();
  const canvas = page.getByTestId("plan-canvas");
  await canvas.focus();
  await page.keyboard.press(" ");
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowLeft");
  await page.keyboard.press(" ");
  await page.keyboard.press("Enter");
  await expect(editor.getByTestId("plan-routes")).toContainText("ZW 1");
});

test.describe("telefon", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("Plany na telefonie: trasa stuknięciami palcem, nazwa analizy widoczna w pasku @mobile", async ({ page }) => {
    await newPlan(page, "Łazienka");
    const editor = page.getByTestId("plan-editor");
    await expect(editor.getByRole("heading", { name: "Łazienka" })).toBeVisible();
    const title = await editor.getByRole("heading", { name: "Łazienka" }).locator("span").first().evaluate((el) => el.scrollWidth <= el.clientWidth);
    expect(title, "nazwa analizy nie jest ucięta").toBe(true);
    await editor.getByRole("button", { name: "Trasa", exact: true }).tap();
    const canvas = page.getByTestId("plan-canvas");
    const box = (await canvas.boundingBox())!;
    const [s, tx, ty] = await Promise.all(["data-scale", "data-tx", "data-ty"].map(async (a) => Number(await canvas.getAttribute(a))));
    for (const [x, y] of [[100, 100], [1400, 100]]) await page.touchscreen.tap(box.x + tx + x * s, box.y + ty + y * s);
    await expect(editor.getByTestId("plan-draft-length")).toHaveText(/^1[23]\d\d px \(bez skali\)$/);
    await editor.getByRole("button", { name: "Zakończ trasę" }).tap();
    await expect(editor.getByTestId("plan-route-length")).toBeVisible();
  });
});
