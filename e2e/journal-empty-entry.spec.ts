import { test, expect } from "@playwright/test";

// Pusty wpis w Dzienniku budowy (QoL, punkt 6): komunikat przy polu, a nie tylko dymek; podwójny klik nie dubluje.

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 14, 12, 0).getTime());
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/praca");
});

test("pusty wpis: komunikat przy polu, pisanie go zdejmuje", async ({ page }) => {
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await page.getByRole("button", { name: /^(Wpis|Dokończ wpis)$/ }).click();
  const sheet = page.getByTestId("journal-entry-sheet");
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "Zapisz wpis" }).click();
  await expect(sheet.getByRole("alert")).toContainText("Wpisz, co się dzieje");
  await expect(sheet.getByLabel("Co się dzieje?")).toHaveAttribute("aria-invalid", "true");
  await sheet.getByLabel("Co się dzieje?").fill("Montaż pionu");
  await expect(sheet.getByRole("alert")).toHaveCount(0);
});
