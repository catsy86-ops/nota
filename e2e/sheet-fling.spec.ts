import { test, expect } from "@playwright/test";

// M4.3: arkusz zsunięty palcem odjeżdża od miejsca puszczenia (bez podskoku do zera), a tło przygasa razem z drogą.
test("zsunięcie arkusza: tło przygasa z palcem, odjazd bez powrotu na górę @mobile", async ({ page, browserName, isMobile }) => {
  test.skip(browserName !== "chromium", "dotyk przez CDP jest tylko w Chromium");
  test.skip(!isMobile, "tylko układ telefonu");
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
  await page.getByRole("button", { name: "Widok i kolumny" }).click();
  const sheet = page.getByRole("dialog", { name: "Widok" });
  await expect(sheet).toBeVisible();
  await page.waitForTimeout(500);
  const handle = sheet.locator("[data-sheet-handle]");
  const box = (await handle.boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  const sheetTop = async () => page.evaluate(() => document.querySelector('[role="dialog"]')?.getBoundingClientRect().top ?? null);
  const top0 = (await sheetTop())!;

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let i = 1; i <= 6; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y + 30 * i }] });
    await page.waitForTimeout(16);
  }
  // W trakcie: tło przyciemnione mniej niż na starcie.
  const dim = await page.evaluate(() => Number((document.querySelector(".fixed.inset-0.z-modal") as HTMLElement | null)?.style.opacity ?? "1"));
  expect(dim).toBeLessThan(1);
  expect(dim).toBeGreaterThan(0);

  // Po puszczeniu: próbki położenia co klatkę — arkusz nie wraca powyżej miejsca puszczenia.
  await page.evaluate(() => {
    const samples: number[] = [];
    (window as unknown as { __tops: number[] }).__tops = samples;
    const tick = () => {
      const el = document.querySelector('[role="dialog"]');
      if (!el) return;
      samples.push(el.getBoundingClientRect().top);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(sheet).toBeHidden();
  const tops = await page.evaluate(() => (window as unknown as { __tops: number[] }).__tops);
  expect(tops.length).toBeGreaterThan(0);
  expect(Math.min(...tops)).toBeGreaterThan(top0 + 150);

  // Ponowne otwarcie: arkusz na swoim miejscu, tło pełne.
  await page.getByRole("button", { name: "Widok i kolumny" }).click();
  await expect(sheet).toBeVisible();
  await expect.poll(sheetTop).toBeLessThan(top0 + 2);
});
