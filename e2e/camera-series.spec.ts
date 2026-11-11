import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { inCard } from "./helpers";

// B3.9 Aparat w aplikacji: seria zdjęć bez zamykania okna, latarka (gdy kamera ją daje), wybór punktu przed zdjęciem,
// zdjęcia przechodzą obróbkę jak z galerii. Kamera jest fałszywa; latarkę udajemy ograniczeniem `torch` ścieżki wideo.
test.use({
  isMobile: true, hasTouch: true, permissions: ["camera"],
  launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.study.tab.v1", "journal");
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      site: "Lipowa 5",
      journal: [{ id: "a", at: Date.now() - 86_400_000, kind: "ok", topic: null, text: "Start", site: "Lipowa 5", checked: [], images: [] }],
    }));
  });
  await page.setViewportSize({ width: 390, height: 844 });
});

/** Telefon z latarką: `getCapabilities` zgłasza `torch`, a `applyConstraints` zapisuje, co ustawiono. */
async function withTorch(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __torch: boolean[] };
    w.__torch = [];
    const proto = MediaStreamTrack.prototype;
    proto.getCapabilities = function () { return { torch: true } as MediaTrackCapabilities; };
    const apply = proto.applyConstraints;
    proto.applyConstraints = async function (c?: MediaTrackConstraints) {
      const t = (c?.advanced?.[0] as { torch?: boolean } | undefined)?.torch;
      if (typeof t === "boolean") { w.__torch.push(t); return; }
      return apply.call(this, c);
    };
  });
}

async function openSheetWithPoints(page: Page) {
  await page.goto("/praca");
  await page.getByTestId("study-journal").getByRole("button", { name: "Lipowa 5: karta budowy" }).first().click();
  const card = page.getByTestId("site-card");
  await (await inCard(card, "site-points")).getByRole("button", { name: /^\+ Łazienka/ }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /^(Wpis|Dokończ wpis)$/ }).click();
  const sheet = page.getByTestId("journal-entry-sheet");
  await sheet.getByLabel("Co się dzieje?").fill("Szacht za łazienką");
  return sheet;
}

const liveTracks = (page: Page) => page.evaluate(() => [...document.querySelectorAll("video")].filter((v) => (v.srcObject as MediaStream | null)?.getTracks().some((t) => t.readyState === "live")).length);

test("seria zdjęć z latarką i punktem: okno zostaje otwarte, limit wpisu, kamera gaśnie po zamknięciu", async ({ page }) => {
  await withTorch(page);
  const sheet = await openSheetWithPoints(page);
  await sheet.getByRole("button", { name: "Aparat" }).click();
  const cam = page.getByTestId("camera-capture");
  await expect(cam.getByTestId("camera-shutter")).toBeEnabled();
  const axe = await new AxeBuilder({ page }).include("[data-testid='camera-capture']").withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);

  // Latarka tylko, gdy kamera ją udostępnia; włącza się i wyłącza.
  const torch = cam.getByTestId("camera-torch");
  await expect(torch).toHaveAttribute("aria-pressed", "false");
  await torch.click();
  await expect(torch).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => (window as unknown as { __torch: boolean[] }).__torch.at(-1))).toBe(true);

  // Punkt wybieramy przed zdjęciem.
  await cam.getByTestId("camera-point").selectOption({ label: "Łazienka · Umywalka" });

  // Seria: okno zostaje otwarte po każdym zdjęciu, licznik rośnie.
  await cam.getByTestId("camera-shutter").click();
  await expect(cam.getByTestId("camera-count")).toContainText("Zdjęcia we wpisie: 1 z 5");
  await cam.getByTestId("camera-shutter").click();
  await expect(cam.getByTestId("camera-count")).toContainText("2 z 5");
  await cam.getByTestId("camera-shutter").click();
  await expect(cam.getByTestId("camera-count")).toContainText("3 z 5");
  await expect(cam.getByTestId("camera-done")).toHaveText("Gotowe");

  // Limit wpisu: 5 zdjęć, potem migawka jest wyłączona.
  await cam.getByTestId("camera-shutter").click();
  await cam.getByTestId("camera-shutter").click();
  await expect(cam.getByTestId("camera-count")).toContainText("komplet zdjęć (5)");
  await expect(cam.getByTestId("camera-shutter")).toBeDisabled();

  await cam.getByTestId("camera-done").click();
  await expect(cam).toHaveCount(0);
  await expect(sheet.getByRole("button", { name: "Usuń zdjęcie z wpisu" })).toHaveCount(5);
  expect(await liveTracks(page)).toBe(0); // kamera (i latarka) zgaszona

  // Zapis wpisu: zdjęcia należą do wybranego punktu.
  await expect(sheet.getByTestId("entry-point")).toContainText("Łazienka · Umywalka");
  await sheet.getByRole("button", { name: "Zapisz wpis" }).click();
  await expect(sheet).toHaveCount(0);
  // Ostatnie zdjęcie punktu widać w panelu punktów karty budowy.
  await page.getByTestId("study-journal").getByRole("button", { name: "Lipowa 5: karta budowy" }).first().click();
  await expect((await inCard(page.getByTestId("site-card"), "site-points")).getByRole("img", { name: "Ostatnie zdjęcie: Umywalka" })).toBeVisible();
});

test("bez latarki w kamerze przycisku nie ma; bez zgody komunikat wskazuje aparat systemowy", async ({ page }) => {
  const sheet = await openSheetWithPoints(page);
  await sheet.getByRole("button", { name: "Aparat" }).click();
  const cam = page.getByTestId("camera-capture");
  await expect(cam.getByTestId("camera-shutter")).toBeEnabled();
  await expect(cam.getByTestId("camera-torch")).toHaveCount(0);
  await cam.getByTestId("camera-done").click();

  // Brak kamery: getUserMedia odrzuca z NotAllowedError.
  await page.evaluate(() => { navigator.mediaDevices.getUserMedia = async () => { throw Object.assign(new Error("x"), { name: "NotAllowedError" }); }; });
  await sheet.getByRole("button", { name: "Aparat" }).click();
  await expect(page.getByTestId("camera-problem")).toContainText("Brak dostępu do kamery");
  await expect(page.getByTestId("camera-problem")).toContainText("aparat systemowy");
  await expect(page.getByTestId("camera-shutter")).toBeDisabled();
});
