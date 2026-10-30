import { test, expect } from "@playwright/test";

// Hydraulika (plan motywów 2026-10-30, 3.1): pokrętło „+” obraca się w czasie przytrzymania (420 ms,
// stan `data-pressing` z BottomNav). Zdarzenie wskaźnika wysyłane ręcznie: prawdziwe `mouse.down` nie
// trafia w ten przycisk w emulacji telefonu (coś leży nad nim — do sprawdzenia osobno).

test.use({ viewport: { width: 390, height: 844 } });

test("pokrętło „+” obraca się w czasie przytrzymania w Hydraulice @mobile", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.skin.v1", JSON.stringify("hydraulika"));
  });
  await page.goto("/");
  const fab = page.locator("button.fab-brand");
  await expect(fab).toBeVisible();
  const icon = fab.locator(":scope > span > svg");
  expect(await icon.evaluate((el) => getComputedStyle(el).transform)).toBe("none");
  await fab.dispatchEvent("pointerdown", { button: 0, isPrimary: true, pointerType: "mouse" });
  await page.waitForTimeout(200);
  expect(await icon.evaluate((el) => getComputedStyle(el).transform)).not.toBe("none");
  await fab.dispatchEvent("pointerup", { button: 0, isPrimary: true, pointerType: "mouse" });
  await page.keyboard.press("Escape");
});
