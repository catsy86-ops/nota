import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

test("raport diagnostyczny pobiera się bez treści notatek", async ({ page }) => {
  const secret = `sekret-${Date.now()}`;
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(secret);
  await page.getByRole("button", { name: "Zamknij" }).click();
  await expect(page.getByText(secret)).toBeVisible();

  await page.getByRole("button", { name: "Ustawienia" }).first().click();
  await page.getByRole("tab", { name: "Ogólne" }).click();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Pobierz" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^notatnik-diagnostyka-.*\.txt$/);

  const text = await readFile((await download.path())!, "utf8");
  expect(text).toContain("Notatnik — raport diagnostyczny");
  expect(text).toMatch(/notatki: [1-9]/);
  expect(text).not.toMatch(/build: dev/);
  expect(text).not.toContain(secret);
});
