import { test, expect, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

async function addNote(page: Page, title: string) {
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(title);
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(page.getByText("Zapisz notatkę...")).toBeVisible();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
}

test("czytnik: ←/→ i przyciski przechodzą do sąsiednich notatek z listy", async ({ page }) => {
  const stamp = Date.now();
  // Najnowsza notatka jest pierwsza na liście.
  const [a, b, c] = [`Pierwsza ${stamp}`, `Druga ${stamp}`, `Trzecia ${stamp}`];
  await addNote(page, a);
  await addNote(page, b);
  await addNote(page, c);

  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Home");
  await page.keyboard.press(" ");
  const reader = page.getByRole("dialog", { name: c });
  await expect(reader).toBeVisible();
  await expect(reader.getByRole("button", { name: "Poprzednia notatka" })).toBeDisabled();

  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("dialog", { name: b })).toBeVisible();
  await expect(page.getByRole("dialog", { name: b })).toHaveAttribute("data-reader-mode", "preview");

  await page.getByRole("button", { name: "Następna notatka" }).click();
  await expect(page.getByRole("dialog", { name: a })).toBeVisible();
  await expect(page.getByRole("button", { name: "Następna notatka" })).toBeDisabled();

  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("dialog", { name: b })).toBeVisible();
  await page.getByRole("button", { name: "Poprzednia notatka" }).click();
  await expect(page.getByRole("dialog", { name: c })).toBeVisible();
});
