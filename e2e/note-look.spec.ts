import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

test("ikona, okładka i ulubione: widoczne na kaflu i w pasku bocznym, przeżywają przeładowanie", async ({ page }) => {
  const title = `Wyglad ${Date.now()}`;
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(title);
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(page.getByText("Zapisz notatkę...")).toBeVisible();

  const card = page.getByRole("article", { name: title });
  await card.hover();
  await card.getByRole("button", { name: "Więcej opcji" }).click();

  await card.getByRole("button", { name: "Ikona i okładka" }).click();
  await page.getByRole("button", { name: "Ustaw ikonę: 🚀" }).click();
  await page.getByRole("button", { name: "Okładka: Morze" }).click();
  await page.keyboard.press("Escape");

  await card.getByRole("button", { name: "Dodaj do ulubionych" }).click();

  await expect(card.locator("h3").getByText("🚀")).toBeVisible();
  await page.getByRole("button", { name: "Pokaż panel" }).click();
  const favorites = page.locator("[data-favorites]");
  await expect(favorites.getByText(title)).toBeVisible();
  await expect(favorites.getByText("🚀")).toBeVisible();

  await page.reload();
  const showPanel = page.getByRole("button", { name: "Pokaż panel" });
  if (await showPanel.isVisible()) await showPanel.click();
  await expect(page.locator("[data-favorites]").getByText(title)).toBeVisible();

  // Usunięcie z ulubionych znika z paska bocznego.
  const again = page.getByRole("article", { name: new RegExp(title) });
  await again.hover();
  await again.getByRole("button", { name: "Więcej opcji" }).click();
  await again.getByRole("button", { name: "Usuń z ulubionych" }).click();
  await expect(page.locator("[data-favorites]")).toHaveCount(0);
});
