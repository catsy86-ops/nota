import { test, expect } from "@playwright/test";

// F1.1: pierścień postępu przy przytrzymaniu „+” na telefonie.

test.use({ viewport: { width: 390, height: 844 } });

// Pasek wjeżdża animacją (y: 80 → 0); mierzymy dopiero, gdy stoi na miejscu.
async function settledFab(page: import("@playwright/test").Page) {
  const fab = page.getByRole("button", { name: "Nowa notatka", exact: true });
  await expect.poll(async () => (await fab.boundingBox())?.y ?? 9999).toBeLessThan(800);
  return fab;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

test("przytrzymanie „+” pokazuje pierścień, a zwolnienie przed progiem go kasuje", async ({ page }) => {
  const fab = await settledFab(page);
  const ring = page.getByTestId("fab-ring");
  const box = await fab.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await expect(ring).toHaveAttribute("data-pressing", "true");
  await page.mouse.up();
  await expect(ring).toHaveAttribute("data-pressing", "false");
  // Krótkie stuknięcie nie otwiera arkusza „Nowa” — to zwykły klik.
  await expect(page.getByRole("dialog", { name: "Nowa" })).toHaveCount(0);
});

test("przytrzymanie dłużej niż 420 ms otwiera arkusz „Nowa”", async ({ page }) => {
  const fab = await settledFab(page);
  const box = await fab.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(500);
  await page.mouse.up();
  await expect(page.getByRole("dialog", { name: "Nowa" })).toBeVisible();
});
