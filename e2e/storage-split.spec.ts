import { test, expect } from "@playwright/test";

// U3.3: „Pokaż, co zajmuje miejsce” w Ustawieniach → Kopia i dane dzieli zajęte miejsce na pliki i dane.
test("podział zajętego miejsca na żądanie", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
  await page.getByRole("button", { name: "Ustawienia" }).first().click();
  await page.getByRole("tab", { name: "Kopia i dane" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Pokaż, co zajmuje miejsce" }).click();
  await expect(dialog.getByTestId("storage-split")).toContainText("zdjęcia i pliki");
  await expect(dialog.getByTestId("storage-split")).toContainText("notatki i pozostałe dane");
});
