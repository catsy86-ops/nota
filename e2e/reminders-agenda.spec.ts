import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.clock.setFixedTime(new Date(2026, 8, 10, 12, 0));
  await page.goto("/");
  await page.setViewportSize({ width: 1280, height: 1000 });
});

async function withReminder(page: import("@playwright/test").Page, title: string, day: string) {
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(title);
  await page.getByRole("button", { name: "Zamknij" }).click();
  const card = page.locator("[data-note-id-wrap]", { hasText: title });
  await card.hover();
  await card.getByRole("button", { name: "Przypomnienie" }).click();
  await page.getByRole("gridcell", { name: day, exact: true }).first().click();
  await page.locator('input[type="time"]').fill("18:00");
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
}

test("przypomnienia to agenda: grupy po terminie, bez przełącznika sortowania", async ({ page }) => {
  // Kolejność tworzenia odwrotna do terminów — agenda ma ją zignorować.
  // W zwykłym widoku sortowanie jest — inaczej asercja niżej byłaby pusta.
  await expect(page.getByRole("button", { name: "Sortowanie" })).toHaveCount(1);
  await withReminder(page, "Za dwa tygodnie", "25");
  await withReminder(page, "Jutro", "11");
  await withReminder(page, "Dzisiaj", "10");

  await page.getByRole("button", { name: "Przypomnienia" }).first().click();
  const sections = page.locator("main section[aria-label]");
  await expect(sections).toHaveCount(3);
  await expect(sections.nth(0)).toHaveAttribute("aria-label", "Dziś");
  await expect(sections.nth(0)).toContainText("Dzisiaj");
  await expect(sections.nth(1)).toHaveAttribute("aria-label", "Najbliższe 7 dni");
  await expect(sections.nth(1)).toContainText("Jutro");
  await expect(sections.nth(2)).toHaveAttribute("aria-label", "Później");
  await expect(sections.nth(2)).toContainText("Za dwa tygodnie");
  await expect(page.getByRole("button", { name: "Sortowanie" })).toHaveCount(0);
});
