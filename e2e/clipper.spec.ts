import { test, expect } from "@playwright/test";

test("ustawienia pokazują zakładkę web clippera z kodem wskazującym na /share", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
  await page.getByRole("button", { name: "Ustawienia" }).first().click();
  await page.getByRole("tab", { name: "Ogólne" }).click();

  const link = page.getByText("Zapisz w G", { exact: true });
  await expect(link).toBeVisible();
  const href = await link.getAttribute("href");
  expect(href).toMatch(/^javascript:\(function\(\)\{/);
  expect(href).toContain("/share");
  await expect(page.getByRole("button", { name: "Kopiuj kod" })).toBeVisible();
});
