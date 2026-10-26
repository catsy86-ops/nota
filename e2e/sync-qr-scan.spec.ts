import { test, expect } from "@playwright/test";

// U-2: „Zeskanuj kod” przy dołączaniu do grupy. Zdjęcie bez kodu daje komunikat, a nie kod w polu.
test("Dołącz do grupy: „Zeskanuj kod” otwiera okno, zdjęcie bez kodu pokazuje komunikat", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/?settings=sync");
  await page.getByRole("button", { name: "Zeskanuj kod" }).click();
  const dialog = page.getByRole("dialog", { name: "Zeskanuj kod" });
  await expect(dialog).toBeVisible();
  await dialog.locator('input[type="file"]').setInputFiles("public/pwa-192.png");
  await expect(dialog.getByRole("status")).toContainText("Nie znalazłem kodu na tym zdjęciu");
});
