import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// H4.3 „Zdjęcia z dnia”: zdjęcia z galerii → wpisy z godziną z EXIF, podzielone po przerwie, budowa z wpisów dnia.

/** Blok APP1 z samym `DateTimeOriginal` (TIFF little-endian). */
function exifApp1(date: string): number[] {
  const le16 = (v: number) => [v & 255, (v >> 8) & 255];
  const le32 = (v: number) => [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255];
  const text = [...date].map((c) => c.charCodeAt(0)).concat(0);
  // Nagłówek 8 B, IFD0 (1 wpis) od 8 → 18 B, IFD EXIF od 26 (1 wpis) → 18 B, tekst od 44.
  const tiff = [
    0x49, 0x49, ...le16(42), ...le32(8),
    ...le16(1), ...le16(0x8769), ...le16(4), ...le32(1), ...le32(26), ...le32(0),
    ...le16(1), ...le16(0x9003), ...le16(2), ...le32(text.length), ...le32(44), ...le32(0),
    ...text,
  ];
  const len = 2 + 6 + tiff.length;
  return [0xff, 0xe1, len >> 8, len & 255, 0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
}

async function baseJpeg(page: Page): Promise<number[]> {
  return page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 40; c.height = 30;
    const g = c.getContext("2d")!;
    g.fillStyle = "#3a7"; g.fillRect(0, 0, 40, 30);
    const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), "image/jpeg", 0.8));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
}

const withExif = (jpeg: number[], date: string) => Buffer.from([...jpeg.slice(0, 2), ...exifApp1(date), ...jpeg.slice(2)]);

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 14, 18, 0).getTime());
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.study.tab.v1", "journal");
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      site: "",
      journal: [{ id: "a", at: new Date(2026, 9, 14, 9).getTime(), kind: "ok", topic: null, text: "Podejścia", site: "Lipowa 5", checked: [], images: [] }],
    }));
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Dziennik" }).click();
});

test("zdjęcia z dnia: dwa wpisy po przerwie, godzina z EXIF, budowa z wpisów dnia", async ({ page }) => {
  const jpeg = await baseJpeg(page);
  await page.getByTestId("photo-day-open").click();
  const dialog = page.getByTestId("photo-day");
  await dialog.getByTestId("photo-day-file").setInputFiles([
    { name: "a.jpg", mimeType: "image/jpeg", buffer: withExif(jpeg, "2026:10:14 07:40:00") },
    { name: "b.jpg", mimeType: "image/jpeg", buffer: withExif(jpeg, "2026:10:14 07:55:00") },
    { name: "c.jpg", mimeType: "image/jpeg", buffer: withExif(jpeg, "2026:10:14 13:05:00") },
  ]);
  await expect(dialog.getByTestId("photo-day-summary")).toHaveText("2 wpisy z 3 zdjęć");
  const groups = dialog.getByTestId("photo-day-group");
  await expect(groups.nth(0)).toContainText("07:40–07:55");
  await expect(groups.nth(0)).toContainText("2 zdjęcia");
  await expect(groups.nth(0).getByRole("combobox")).toHaveValue("Lipowa 5");
  await expect(groups.nth(0)).toContainText("z godzin i wpisów tego dnia");
  const axe = await new AxeBuilder({ page }).include("[data-testid='photo-day']").withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
  expect(axe.violations).toEqual([]);

  await groups.nth(1).getByRole("combobox").selectOption("");
  await dialog.getByRole("button", { name: "Dodaj wpisy" }).click();
  await expect(page.getByText("Dodano 2 wpisy ze zdjęć")).toBeVisible();
  await expect(dialog).toBeHidden();

  const times = page.getByTestId("study-journal").locator("[data-journal-entry] time");
  await expect(times).toHaveText(["13:05", "09:00", "07:40"]);
});

test("zdjęcie bez EXIF: godzina z pliku i podpowiedź o tym", async ({ page }) => {
  const jpeg = await baseJpeg(page);
  await page.getByTestId("photo-day-open").click();
  const dialog = page.getByTestId("photo-day");
  await dialog.getByTestId("photo-day-file").setInputFiles([{ name: "x.jpg", mimeType: "image/jpeg", buffer: Buffer.from(jpeg) }]);
  await expect(dialog.getByTestId("photo-day-summary")).toHaveText("1 wpis z 1 zdjęcia");
  await expect(dialog).toContainText("1 zdjęcie nie ma czasu zrobienia");
});
