import { test, expect, type Page } from "@playwright/test";

// Plan UI/UX 3.10: „Widok” na telefonie ma punkty „pół” i „pełny”; przeciągnięcie uchwytu zmienia wysokość.
// Gest dotykowy przez CDP, jak w mobile.spec.ts — mysz na emulowanym telefonie nie daje tych zdarzeń.
test("arkusz Widok: startuje na pół ekranu, przeciągnięcie w górę otwiera pełny, w dół wraca @mobile", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "dotyk przez CDP jest tylko w Chromium");
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
  await page.getByRole("button", { name: "Widok i kolumny" }).click();

  const sheet = page.getByRole("dialog", { name: "Widok" });
  await expect(sheet).toBeVisible();
  const handle = sheet.locator("[data-sheet-handle]");
  const vh = await page.evaluate(() => window.innerHeight);
  const height = async () => Math.round((await sheet.boundingBox())!.height);

  // Pół ekranu (55 dvh), z tolerancją na pasek adresu.
  await page.waitForTimeout(500);
  expect(await height()).toBeGreaterThan(vh * 0.5);
  expect(await height()).toBeLessThan(vh * 0.62);

  const cdp = await page.context().newCDPSession(page);
  const drag = async (dist: number) => {
    const box = (await handle.boundingBox())!;
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    for (let i = 1; i <= 8; i++) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y + (dist * i) / 8 }] });
      await page.waitForTimeout(30);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(350);
  };

  // W górę: pełny ekran.
  await drag(-160);
  await expect.poll(height).toBeGreaterThan(vh * 0.85);

  // W dół z pełnego: wraca na pół, arkusz jeszcze otwarty.
  await drag(200);
  await expect.poll(height).toBeLessThan(vh * 0.62);
  await expect(sheet).toBeVisible();
});
