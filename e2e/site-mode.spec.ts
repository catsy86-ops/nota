import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

test("tryb budowa: większy tekst, cele ≥ 52 px, gładkie tło, „Cofnij” 8 s @mobile", async ({ page }) => {
  const html = page.locator("html");
  await page.getByRole("button", { name: "Więcej", exact: true }).click();
  await page.getByRole("button", { name: "Ustawienia" }).last().click();
  await page.getByRole("tab", { name: "Wygląd" }).click();
  await page.getByRole("group", { name: "Tryb budowa" }).getByRole("button", { name: "Włączony" }).click();
  await expect(html).toHaveAttribute("data-site", "");
  expect(await html.evaluate((el) => getComputedStyle(el).fontSize)).toBe("18px");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Ustawienia" })).toBeHidden();

  // Kratka zeszytu znika.
  expect(await page.locator(".paper-grid").evaluate((el) => getComputedStyle(el, "::before").content)).toBe("none");

  // Przycisk ikonowy w nagłówku łapie palec na ≥ 52 px (widoczny przycisk + obszar ::after).
  const btn = page.getByRole("button", { name: "Filtry" }).first();
  const size = await btn.evaluate((el) => {
    const a = getComputedStyle(el, "::after");
    return Math.min(parseFloat(a.width), parseFloat(a.height));
  });
  expect(size).toBeGreaterThanOrEqual(52);

  // Dymek z „Cofnij” ma 8 s.
  await page.getByRole("button", { name: "Nowa notatka" }).click();
  await page.getByPlaceholder("Tytuł").fill("Do kosza w rękawicach");
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  const toast = page.locator("[data-sonner-toast].toast-undo").last();
  await expect(toast).toBeVisible();
  expect(await toast.evaluate((el) => (el as HTMLElement).style.getPropertyValue("--toast-ms"))).toBe("8000ms");

  await page.reload();
  await expect(html).toHaveAttribute("data-site", "");
});
