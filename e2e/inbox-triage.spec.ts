import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/skrzynka");
});

async function capture(page: import("@playwright/test").Page, text: string) {
  const input = page.getByLabel("Przechwyć do skrzynki");
  await input.fill(text);
  await input.press("Enter");
  await expect(page.getByText("Zapisano w skrzynce")).toBeVisible();
}

test("skrzynka: porządkowanie — archiwizacja, cofnięcie, kosz i zostawienie", async ({ page }) => {
  const stamp = Date.now();
  await capture(page, `Pierwsza ${stamp}`);
  await capture(page, `Druga ${stamp}`);

  await page.getByRole("button", { name: /Porządkuj skrzynkę \(2\)/ }).click();
  const dialog = page.getByRole("dialog", { name: "Porządkowanie skrzynki" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("1 z 2");

  await dialog.getByRole("button", { name: "Archiwizuj" }).click();
  await expect(dialog).toContainText("2 z 2");

  await dialog.getByRole("button", { name: "Cofnij" }).click();
  await expect(dialog).toContainText("1 z 2");

  await dialog.getByRole("button", { name: "Kosz" }).click();
  await expect(dialog).toContainText("2 z 2");

  await dialog.getByRole("button", { name: "Zostaw w skrzynce" }).click();
  await expect(dialog).toContainText("Gotowe — skrzynka opróżniona.");
});
