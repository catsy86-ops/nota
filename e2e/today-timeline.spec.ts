import { test, expect, type Page } from "@playwright/test";
import { seedNotes } from "./helpers";

// Dziś 2.4: oś dnia pod kartą zmiany — termin w swojej godzinie, klik otwiera notatkę, zwinięcie pamięta urządzenie.
const NOW = new Date("2026-10-14T12:00:00");
const AT = new Date("2026-10-14T15:30:00").getTime();

async function open(page: Page) {
  await page.clock.setFixedTime(NOW);
  await seedNotes(page, [
    { id: "t1", title: "Odbiór instalacji", content: "", color: "default", pinned: false, archived: false, labels: [], reminder: AT, createdAt: AT, updatedAt: AT },
  ]);
  await page.goto("/dzis");
  return page.getByTestId("today-timeline");
}

test("komputer: oś dnia rozwinięta, strona nie skacze, zwinięcie zostaje po odświeżeniu", async ({ page }) => {
  const timeline = await open(page);
  const toggle = timeline.getByRole("button", { name: /Oś dnia/ });
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(timeline).toContainText("1 w godzinach");
  // Strona nie przewija się do linii „teraz” — przewija się tylko pojemnik osi.
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await page.reload();
  await expect(page.getByTestId("today-timeline").getByRole("button", { name: /Oś dnia/ })).toHaveAttribute("aria-expanded", "false");
});

test.describe("telefon", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("oś dnia domyślnie zwinięta @mobile", async ({ page }) => {
    const timeline = await open(page);
    await expect(timeline.getByRole("button", { name: /Oś dnia/ })).toHaveAttribute("aria-expanded", "false");
    await timeline.getByRole("button", { name: /Oś dnia/ }).click();
    await expect(timeline.getByRole("button", { name: /Odbiór instalacji/ })).toBeVisible();
  });
});
