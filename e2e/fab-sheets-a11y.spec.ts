import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";

// Faza 4 planu FAB: arkusz „Nowa” i arkusz terminu przechodzą axe (WCAG 2.2 AA) na telefonie.

test.use({ viewport: { width: 390, height: 844 } });

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function openNowa(page: Page) {
  const fab = page.getByRole("button", { name: "Nowa notatka", exact: true });
  await expect.poll(async () => (await fab.boundingBox())?.y ?? 9999).toBeLessThan(800);
  const box = await fab.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(500);
  await page.mouse.up();
  return page.getByRole("dialog", { name: "Nowa" });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

test("arkusz „Nowa” przechodzi axe", async ({ page }) => {
  const sheet = await openNowa(page);
  await expect(sheet).toBeVisible();
  // Kafle wjeżdżają kaskadą (opacity od 0); mierzymy kontrast dopiero po animacjach.
  await page.waitForTimeout(700);
  const result = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(TAGS).analyze();
  expect(result.violations.map((v) => v.id)).toEqual([]);
});

test("arkusz terminu przechodzi axe", async ({ page }) => {
  await page.getByRole("button", { name: "Nowa notatka", exact: true }).click();
  await page.getByRole("button", { name: "Przypomnienie", exact: true }).first().click();
  const sheet = page.getByRole("dialog", { name: "Przypomnienie" });
  await expect(sheet).toBeVisible();
  // Kafle wjeżdżają kaskadą (opacity od 0); mierzymy kontrast dopiero po animacjach.
  await page.waitForTimeout(700);
  const result = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(TAGS).analyze();
  expect(result.violations.map((v) => v.id)).toEqual([]);
});
