import { test, expect } from "@playwright/test";

// Formularz nowej notatki pokazuje datę i czas otwarcia (AddNoteBar, „Data i czas”).

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 14, 12, 0, 0));
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

test("nowa notatka: data i czas są widoczne w formularzu", async ({ page }) => {
  await page.getByText("Zapisz notatkę...").click();
  await expect(page.getByText("Data i czas: 14 paź 2026, 12:00")).toBeVisible();
  await expect(page.locator("time[datetime]").first()).toHaveAttribute("datetime", new Date(2026, 9, 14, 12, 0, 0).toISOString());
});
