import { test, expect } from "@playwright/test";

// A1: na telefonie widoki bez własnego pola szukania mają wejście do palety z dwóch miejsc —
// lupę w nagłówku i slot „Szukaj” w dolnym pasku. Widoki z polem szukania (Notatki) mają pole w treści.
test.use({ isMobile: true, hasTouch: true, viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 28, 12, 0).getTime());
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
});

test("Grafik na telefonie: lupa w nagłówku i „Szukaj” w dolnym pasku otwierają paletę", async ({ page }) => {
  await page.goto("/grafik");
  const header = page.getByRole("button", { name: "Szukaj i polecenia" });
  await expect(header).toBeVisible();
  await header.click();
  await expect(page.getByRole("dialog").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.getByRole("navigation").getByRole("button", { name: "Szukaj", exact: true }).click();
  await expect(page.getByRole("dialog").first()).toBeVisible();
});

test("Notatki na telefonie: pole szukania jest w widoku, bez lupy w nagłówku", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Szukaj i polecenia" })).toHaveCount(0);
});
