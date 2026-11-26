import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";

// „O aplikacji” obok Ustawień: autor, wyróżniki i wszystkie funkcje działami.

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.emulateMedia({ reducedMotion: "reduce" });
});

async function checkDialog(page: Page) {
  const dialog = page.getByTestId("about-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("about-author")).toHaveText("Made by Grzegorz K.");
  await expect(dialog.getByRole("heading", { name: /Co wyróżnia/ })).toBeVisible();
  await dialog.locator("summary").filter({ hasText: /^Grafik/ }).click();
  await expect(dialog.getByText(/^Rozliczenie godzin:/)).toBeVisible();
  const axe = await new AxeBuilder({ page }).include('[data-testid="about-dialog"]').withTags(TAGS).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
}

test("komputer: ikona obok Ustawień w pasku bocznym otwiera „O aplikacji”", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("iphone") || testInfo.project.name.includes("pixel"), "pasek boczny jest na komputerze");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.getByRole("group", { name: "Szybkie akcje" }).getByRole("button", { name: "O aplikacji" }).click();
  await checkDialog(page);
});

test("komputer: wiersz z wersją w stopce otwiera to samo okno, z wersją i aktualizacją", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("iphone") || testInfo.project.name.includes("pixel"), "pasek boczny jest na komputerze");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.getByRole("button", { name: /^O aplikacji · wersja/ }).click();
  const dialog = page.getByTestId("about-dialog");
  await expect(dialog.getByRole("heading", { name: "Wersja i aktualizacja" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
});

test.describe("telefon", () => {
  test.use({ isMobile: true, hasTouch: true, viewport: { width: 390, height: 844 } });
  test("kafel „O aplikacji” w arkuszu „Więcej” obok Ustawień @mobile", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^Więcej(: .+)?$/ }).click();
    await page.getByRole("button", { name: "O aplikacji" }).click();
    await checkDialog(page);
  });
});
