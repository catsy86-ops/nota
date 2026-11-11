import { test, expect } from "@playwright/test";

// B5.5: miniatury obok oryginałów — paski i lista wpisów pokazują małą wersję, powiększenie pełną.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.study.tab.v1", "journal");
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test("zdjęcie we wpisie w liście jest miniaturą (≤256 px), a oryginał zostaje w magazynie", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("button", { name: /^(Wpis|Dokończ wpis)$/ }).click();
  const sheet = page.getByTestId("journal-entry-sheet");
  await sheet.getByLabel("Co się dzieje?").fill("Zdjęcie z miniaturą");
  const b64 = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 1600; c.height = 1200;
    const ctx = c.getContext("2d")!;
    for (let i = 0; i < 400; i++) { ctx.fillStyle = `hsl(${(i * 37) % 360} 60% 50%)`; ctx.fillRect((i * 53) % 1600, (i * 31) % 1200, 120, 90); }
    return c.toDataURL("image/jpeg", 0.9).split(",")[1];
  });
  await sheet.getByTestId("journal-photo-input").setInputFiles({ name: "duze.jpg", mimeType: "image/jpeg", buffer: Buffer.from(b64, "base64") });
  await sheet.getByRole("button", { name: /^Zapisz/ }).click();

  const img = page.locator("[data-journal-entry] img").first();
  await expect(img).toBeVisible();
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
  const w = await img.evaluate((el: HTMLImageElement) => Math.max(el.naturalWidth, el.naturalHeight));
  expect(w).toBeLessThanOrEqual(256);

  // Oryginał nietknięty w magazynie: największy rekord ma pełne wymiary i jest dużo większy niż miniatura.
  const sizes = await page.evaluate(async () => {
    const open = (name: string) => new Promise<IDBDatabase>((res, rej) => { const q = indexedDB.open(name); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
    const all = (db: IDBDatabase, store: string) => new Promise<unknown[]>((res) => { const r = db.transaction(store).objectStore(store).getAll(); r.onsuccess = () => res(r.result); });
    const full = (await all(await open("kaczy-images-v1"), "images")) as { bytes: ArrayBuffer }[];
    const thumbs = (await all(await open("kaczy-images-v1-thumbs"), "thumbs")) as (Blob | false)[];
    return { full: Math.max(...full.map((r) => r.bytes.byteLength)), thumb: Math.max(...thumbs.map((t) => (t ? t.size : 0))) };
  });
  expect(sizes.thumb).toBeGreaterThan(0);
  expect(sizes.full).toBeGreaterThan(sizes.thumb * 3);
});
