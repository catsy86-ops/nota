import { test, expect } from "@playwright/test";

// Paleta (QoL): „Utwórz notatkę „X”” zachowuje wpisany tekst jako tytuł nowej notatki.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

test("paleta: wpisany tekst staje się tytułem nowej notatki", async ({ page }) => {
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox").first().fill("Zakupy na jutro");
  await page.getByText(/Utwórz notatkę „Zakupy na jutro”/).click();
  await expect(page.getByPlaceholder("Tytuł")).toHaveValue("Zakupy na jutro");
});
