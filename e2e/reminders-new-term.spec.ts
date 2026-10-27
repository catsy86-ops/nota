import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.clock.setFixedTime(new Date(2026, 8, 10, 12, 0));
  await page.goto("/");
  await page.setViewportSize({ width: 1280, height: 1000 });
});

test("Terminy: „Nowy termin” z datą i godziną tworzy notatkę z przypomnieniem", async ({ page }) => {
  await page.getByRole("button", { name: "Terminy" }).first().click();
  await page.getByRole("button", { name: "Nowy termin" }).click();

  const dialog = page.getByRole("dialog", { name: "Nowy termin" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Treść nowej notatki z terminem").fill("Wizyta u lekarza");
  // Dzień i godzina z kalendarza/pól, nie z języka naturalnego.
  await dialog.getByLabel("Dzień przypomnienia").fill("2026-09-15");
  await dialog.getByLabel("Godzina przypomnienia").fill("14:30");
  await dialog.getByRole("button", { name: "Utwórz notatkę z terminem" }).click();

  await expect(dialog).toBeHidden();
  const card = page.locator("[data-note-id-wrap]", { hasText: "Wizyta u lekarza" });
  await expect(card).toHaveCount(1);
  await expect(card).toContainText("15");
  await expect(card).toContainText("14:30");
});
