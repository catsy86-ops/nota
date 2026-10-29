import { test, expect } from "@playwright/test";

// K4.5: wybór dnia w siatce idzie przez przejście widoku (podświetlenie i panel dnia),
// a przy redukcji ruchu zostaje przenikanie — bez przesunięć (CSS w `index.css`).

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    // Liczymy wywołania przejścia widoku, żeby test nie zależał od animacji.
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    const orig = doc.startViewTransition?.bind(doc);
    (window as unknown as { __vt: number }).__vt = 0;
    if (orig) doc.startViewTransition = (cb: () => void) => { (window as unknown as { __vt: number }).__vt++; return orig(cb); };
  });
});

async function pickOtherDay(page: import("@playwright/test").Page) {
  await page.goto("/kalendarz");
  const other = page.locator('[role="gridcell"][aria-selected="false"]').first();
  const key = await other.getAttribute("data-day-key");
  await other.click();
  await expect(page.locator(`[data-day-key="${key}"]`)).toHaveAttribute("aria-selected", "true");
}

test("klik w dzień w siatce uruchamia przejście widoku", async ({ page }) => {
  await pickOtherDay(page);
  expect(await page.evaluate(() => (window as unknown as { __vt: number }).__vt)).toBeGreaterThan(0);
});

test("przy redukcji ruchu przejście nadal działa (przenikanie)", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await pickOtherDay(page);
  expect(await page.evaluate(() => (window as unknown as { __vt: number }).__vt)).toBeGreaterThan(0);
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
});
