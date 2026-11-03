import { test, expect } from "@playwright/test";

// Skrzynka 2.3: przechwycenie z każdego miejsca — Alt+K, paleta „Do skrzynki…”, skrót PWA `?skrzynka=1`.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test("Alt+K w Kalendarzu: okno „Do skrzynki”, Enter zapisuje, widok zostaje @smoke", async ({ page }) => {
  await page.goto("/kalendarz");
  await expect(page.locator("main").first()).toBeVisible();
  await page.keyboard.press("Alt+k");
  const dialog = page.getByTestId("quick-inbox");
  await expect(dialog.getByRole("heading", { name: "Do skrzynki" })).toBeVisible();
  const input = dialog.getByLabel("Przechwyć do skrzynki");
  await expect(input).toBeFocused();
  await input.fill("Kupić klej PCV");
  await input.press("Enter");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("Zapisano w skrzynce")).toBeVisible();
  await expect(page).toHaveURL(/\/kalendarz$/);

  await page.goto("/skrzynka");
  await expect(page.locator("[data-note-id]").filter({ hasText: "Kupić klej PCV" })).toHaveCount(1);
});

test("Alt+K działa też z pola wyszukiwania, a Esc zamyka okno bez zapisu", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("/");
  await page.keyboard.press("Alt+k");
  const dialog = page.getByTestId("quick-inbox");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("Zapisano w skrzynce")).toHaveCount(0);
});

test("paleta: „Do skrzynki…” otwiera to samo okno", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Control+k");
  await page.getByRole("option", { name: /Do skrzynki/ }).click();
  await expect(page.getByTestId("quick-inbox").getByLabel("Przechwyć do skrzynki")).toBeVisible();
});

test("skrót PWA `?skrzynka=1` otwiera okno i czyści adres", async ({ page }) => {
  await page.goto("/?skrzynka=1");
  await expect(page.getByTestId("quick-inbox").getByLabel("Przechwyć do skrzynki")).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});
