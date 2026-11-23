import { test, expect } from "@playwright/test";

// Z-6.6: Ustawienia → Kopia i dane → „Sprawdź nieużywane pliki” (logika usuwania: `imageStore.test.ts`).
test("sprawdzenie nieużywanych plików w Ustawieniach — świeża aplikacja nie ma czego usuwać", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
  await page.getByRole("button", { name: "Ustawienia" }).first().click();
  await page.getByRole("tab", { name: "Kopia i dane" }).click();
  await page.getByRole("button", { name: "Sprawdź nieużywane pliki" }).click();
  await expect(page.getByTestId("unused-files-result")).toHaveText("Brak nieużywanych plików.");
});
