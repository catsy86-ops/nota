import { test, expect } from "@playwright/test";

// Kompozytor (QoL, punkt 11): dwa szybkie zapisy nie tworzą dwóch notatek.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

test("dwa szybkie Ctrl+Enter zapisują jedną notatkę", async ({ page }) => {
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill("Jedna notatka");
  await page.getByPlaceholder("Tytuł").press("Control+Enter");
  await page.getByPlaceholder("Tytuł").press("Control+Enter");
  // Kafel animuje się po zapisie (może chwilowo być widoczny dwa razy), więc liczymy po odstępie.
  await page.waitForTimeout(1000);
  await expect(page.locator("[data-note-id-wrap]", { hasText: "Jedna notatka" })).toHaveCount(1);
});
