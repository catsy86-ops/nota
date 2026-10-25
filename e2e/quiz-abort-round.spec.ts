import { test, expect } from "@playwright/test";

// Przerwanie rundy quizu (Etap 4 § P3): przycisk wraca do startu, bez komunikatu o wyniku.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/praca");
});

test("Przerwij rundę wraca do ekranu startowego quizu", async ({ page }) => {
  await page.getByRole("tab", { name: "Quiz" }).click().catch(() => undefined);
  const quiz = page.getByRole("region", { name: "Quiz" });
  await quiz.getByRole("button", { name: /Zacznij|Start|Rozpocznij/ }).first().click();
  await expect(quiz.getByRole("button", { name: "Przerwij rundę" })).toBeVisible();
  await quiz.getByRole("button", { name: "Przerwij rundę" }).click();
  await expect(quiz.getByRole("button", { name: "Przerwij rundę" })).toHaveCount(0);
  await expect(quiz.getByText("Sprawdź, co umiesz")).toBeVisible();
});
