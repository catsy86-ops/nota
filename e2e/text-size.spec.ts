import { test, expect, type Page } from "@playwright/test";

// Rozmiar tekstu (src/lib/textSize.ts): przyciski w Ustawieniach, zapis, skala korzenia
// i brak poziomego przewijania przy największym kroku na telefonie.

const VIEWS = ["/", "/przypomnienia", "/kalendarz", "/grafik", "/praca"];

async function withStep(page: Page, step: number) {
  await page.addInitScript((s) => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.textSize.v1", String(s));
  }, step);
}

test("Ustawienia → Wygląd: „Zwiększ” i „Zmniejsz” zmieniają krok, „Przywróć” wraca do domyślnego", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Ustawienia", exact: true }).first().click();

  const root = page.locator("html");
  await expect(root).toHaveAttribute("data-text-size", "1");
  await page.getByRole("button", { name: "Zwiększ tekst" }).click();
  await expect(root).toHaveAttribute("data-text-size", "2");
  await page.getByRole("button", { name: "Zmniejsz tekst" }).click();
  await page.getByRole("button", { name: "Zmniejsz tekst" }).click();
  await expect(root).toHaveAttribute("data-text-size", "0");
  await expect(page.getByRole("button", { name: "Zmniejsz tekst" })).toBeDisabled();
  await page.getByRole("button", { name: "Przywróć", exact: true }).click();
  await expect(root).toHaveAttribute("data-text-size", "1");
});

test("największy rozmiar: skala korzenia 140 % i bez poziomego przewijania na telefonie", async ({ page }) => {
  await withStep(page, 4);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of VIEWS) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const size = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
    expect(parseFloat(size), `korzeń na ${path}`).toBeCloseTo(16 * 1.4, 1);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `poziome przewijanie na ${path}`).toBeLessThanOrEqual(1);
  }
});

test("mniejszy rozmiar zmniejsza korzeń do 90 %", async ({ page }) => {
  await withStep(page, 0);
  await page.goto("/");
  const size = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
  expect(parseFloat(size)).toBeCloseTo(16 * 0.9, 1);
});
