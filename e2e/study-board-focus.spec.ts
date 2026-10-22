import { test, expect } from "@playwright/test";

test("tablica: po przesunięciu tematu fokus zostaje na tej karcie w nowej kolumnie", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Tablica" }).click();

  const card = page.locator("li[data-topic]").first();
  const topicId = await card.getAttribute("data-topic");
  await card.getByRole("button", { name: /przenieś do/ }).last().click();
  await expect(page.locator(`li[data-topic="${topicId}"]`)).toBeFocused();
});
