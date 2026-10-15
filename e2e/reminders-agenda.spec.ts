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
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  const card = page.locator("[data-note-id-wrap]", { hasText: title });
  await card.hover();
  await card.getByRole("button", { name: "Przypomnienie" }).click();
  // react-day-picker 9: gridcell to komórka, dzień to przycisk z pełną datą w nazwie.
  await page.locator("[role=gridcell]:not([data-outside]) button", { hasText: new RegExp(`^${day}$`) }).first().click();
  await page.locator('input[type="time"]').fill("18:00");
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
}

test("przypomnienia to agenda: grupy po terminie, bez przełącznika sortowania @smoke", async ({ page }) => {
  // Tytuły nie mogą być frazą daty („Jutro”) — szybkie wprowadzanie zamieniłoby je w przypomnienie.
  // Kolejność tworzenia odwrotna do terminów — agenda ma ją zignorować.
  // W zwykłym widoku sortowanie jest — inaczej asercja niżej byłaby pusta.
  await expect(page.getByRole("button", { name: "Sortowanie" })).toHaveCount(1);
  await withReminder(page, "Zebranie dalekie", "25");
  await withReminder(page, "Zebranie jutrzejsze", "11");
  await withReminder(page, "Zebranie dzisiejsze", "10");

  await page.getByRole("button", { name: "Przypomnienia" }).first().click();
  const sections = page.locator("main section[aria-label]");
  await expect(sections).toHaveCount(3);
  await expect(sections.nth(0)).toHaveAttribute("aria-label", "Dziś");
  await expect(sections.nth(0)).toContainText("Zebranie dzisiejsze");
  await expect(sections.nth(1)).toHaveAttribute("aria-label", "Najbliższe 7 dni");
  await expect(sections.nth(1)).toContainText("Zebranie jutrzejsze");
  await expect(sections.nth(2)).toHaveAttribute("aria-label", "Później");
  await expect(sections.nth(2)).toContainText("Zebranie dalekie");
  await expect(page.getByRole("button", { name: "Sortowanie" })).toHaveCount(0);
});
