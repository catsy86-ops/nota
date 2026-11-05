import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";
import { seedNotes } from "./helpers";

// Dziś 4.2 (Plan-nowy 2.4): pozycje list zmienionych dziś odhacza się prosto z Dziś, z „Cofnij”.
const NOW = new Date(2026, 10, 5, 12, 0);
const T = NOW.getTime();

test("Dziś: „Listy na dziś” — odhaczenie pozycji bez otwierania notatki i Cofnij", async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedNotes(page, [
    { id: "z", title: "Zakupy", content: "", color: "default", pinned: false, archived: false, labels: [], createdAt: T - 3600_000, updatedAt: T - 3600_000,
      checklist: [{ id: "i1", text: "mleko", checked: false }, { id: "i2", text: "chleb", checked: false }] },
    { id: "s", title: "Stara lista", content: "", color: "default", pinned: false, archived: false, labels: [], createdAt: T - 5 * 86400_000, updatedAt: T - 5 * 86400_000,
      checklist: [{ id: "i3", text: "nie dziś", checked: false }] },
  ]);
  await page.goto("/dzis");
  const card = page.getByTestId("today-lists");
  await expect(card).toBeVisible();
  await expect(card.getByText("mleko")).toBeVisible();
  await expect(card.getByText("nie dziś")).toHaveCount(0);

  await card.getByRole("checkbox", { name: "Odhacz: mleko" }).click();
  await expect(card.getByText("mleko")).toHaveCount(0);
  await expect(card.getByText("chleb")).toBeVisible();

  await page.locator("[data-sonner-toast]").getByRole("button", { name: "Cofnij" }).click();
  await expect(card.getByText("mleko")).toBeVisible();

  // Karta przechodzi ten sam audyt co reszta (`a11y.spec.ts`, WCAG 2.2 AA) — Dziś nie ma go w tamtym zestawie.
  await page.waitForTimeout(500);
  const axe = await new AxeBuilder({ page }).include('[data-testid="today-lists"]').withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
});
