import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test("kafel wyróżnia trafienia wyszukiwania, także bez ogonków", async ({ page }) => {
  await page.goto("/skrzynka");
  const input = page.getByLabel("Przechwyć do skrzynki");
  await input.fill("Mały żółw na łące");
  await input.press("Enter");
  await expect(page.getByText("Zapisano w skrzynce")).toBeVisible();
  await input.fill("Plan dnia");
  await input.press("Enter");
  await expect(page.getByText("Zapisano w skrzynce").first()).toBeVisible();

  await page.goto("/?q=zolw");
  const tile = page.locator("[data-note-id]").filter({ hasText: "Mały żółw" });
  await expect(tile).toHaveCount(1);
  await expect(tile.locator("mark")).toHaveText("żółw");
  await expect(page.locator("[data-note-id]").filter({ hasText: "Plan dnia" })).toHaveCount(0);
});

test("trafienie tylko w treści pokazuje fragment z zaznaczeniem zamiast początku", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill("Notatka o budowie");
  await page.getByPlaceholder("Treść notatki...").fill("Na początku same ogólniki, a dopiero potem wspominamy o kotem na dachu.");
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Notatka o budowie" })).toBeVisible();

  await page.goto("/?q=kotem");
  const tile = page.locator("[data-note-id]").filter({ hasText: "Notatka o budowie" });
  await expect(tile).toHaveCount(1);
  await expect(tile.locator("mark")).toHaveText("kotem");
  // Zapowiedź pokazuje fragment z trafieniem, nie początek treści.
  await expect(tile.getByText("Na początku same ogólniki")).toHaveCount(0);
});
