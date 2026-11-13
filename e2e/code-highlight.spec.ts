import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

test("czytnik: blok ```ts jest kolorowany, a blok bez języka zostaje zwykłym tekstem (5.3)", async ({ page }) => {
  const title = `Kod ${Date.now()}`;
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(title);
  await page.getByPlaceholder("Treść notatki...").fill("```ts\nconst x: number = 1; // liczba\n```\n\n```\nzwykły blok\n```");
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(page.getByText("Zapisz notatkę...")).toBeVisible();
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Home");
  await page.keyboard.press(" ");
  const reader = page.getByRole("dialog", { name: title });
  await expect(reader.locator("pre.code-hl .tok-keyword").first()).toHaveText("const");
  await expect(reader.locator("pre.code-hl .tok-comment")).toContainText("liczba");
  await expect(reader.locator("pre", { hasText: "zwykły blok" }).locator("span")).toHaveCount(0);
});
