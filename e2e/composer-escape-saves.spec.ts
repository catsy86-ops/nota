import { test, expect } from "@playwright/test";

// Esc w kompozytorze zapisuje notatkę i zamyka edytor (jak Ctrl+Enter i klik poza edytorem).

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

test("Esc zapisuje notatkę", async ({ page }) => {
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill("Zapisana Esc");
  await page.getByPlaceholder("Tytuł").press("Escape");
  await expect(page.getByRole("heading", { name: "Zapisana Esc" })).toBeVisible();
});
