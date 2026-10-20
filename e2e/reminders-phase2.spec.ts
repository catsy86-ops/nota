import { test, expect, type Page } from "@playwright/test";

// Plan Przypomnień, decyzje D2 („Gotowe” przy każdym terminie w Terminach) i fokus po akcji (2c).

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.clock.setFixedTime(new Date(2026, 8, 10, 12, 0));
  await page.goto("/");
  await page.setViewportSize({ width: 1280, height: 1000 });
});

async function withReminder(page: Page, title: string, day: string) {
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(title);
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  const card = page.locator("[data-note-id-wrap]", { hasText: title });
  await card.hover();
  await card.getByRole("button", { name: "Przypomnienie" }).click();
  await page.locator("[role=gridcell]:not([data-outside]) button", { hasText: new RegExp(`^${day}$`) }).first().click();
  await page.locator('input[type="time"]').fill("18:00");
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
}

test("Gotowe działa przy nadchodzącym terminie w Terminach i zdejmuje go z listy (D2)", async ({ page }) => {
  await withReminder(page, "Zebranie nadchodzące", "11");

  await page.getByRole("button", { name: "Przypomnienia" }).first().click();
  const card = page.locator("[data-note-id-wrap]", { hasText: "Zebranie nadchodzące" });
  await expect(card).toHaveCount(1);
  await card.getByRole("button", { name: "Gotowe" }).click();

  await expect(card).toHaveCount(0);
});

test("pusty widok Terminów: „Nowa notatka” otwiera edytor (1d)", async ({ page }) => {
  await page.getByRole("button", { name: "Przypomnienia" }).first().click();
  await expect(page.getByText("Brak przypomnień")).toBeVisible();
  await page.getByRole("button", { name: "Nowa notatka", exact: true }).click();
  await expect(page.getByPlaceholder("Tytuł").first()).toBeVisible();
});
