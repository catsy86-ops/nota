import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    if (!sessionStorage.getItem("e2e-theme")) {
      sessionStorage.setItem("e2e-theme", "1");
      localStorage.setItem("kaczy-theme", "light");
    }
  });
  await page.goto("/");
});

async function openAppearance(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Ustawienia" }).first().click();
  await page.getByRole("tab", { name: "Wygląd" }).click();
}

test("styl Neon: ciemne kolory, jasność zablokowana, wybór przeżywa odświeżenie @smoke", async ({ page }) => {
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-skin", "zeszyt");
  await expect(html).not.toHaveClass(/\bdark\b/);

  await openAppearance(page);
  const neon = page.locator('[data-skin-option="neon"]');
  await neon.click();
  await expect(neon).toHaveAttribute("aria-pressed", "true");
  await expect(html).toHaveAttribute("data-skin", "neon");
  await expect(html).toHaveClass(/\bdark\b/);
  await expect(page.getByRole("group", { name: "Jasność" }).getByRole("button", { name: "Jasny" })).toBeDisabled();
  await expect(page.getByText("Neon ma własne, ciemne kolory.", { exact: false })).toBeVisible();

  await page.reload();
  await expect(html).toHaveAttribute("data-skin", "neon");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#130a1b");
});

test("przełącznik jasny/ciemny w nagłówku wraca ze stylu do Zeszytu", async ({ page }) => {
  await openAppearance(page);
  await page.locator('[data-skin-option="miedz"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-skin", "miedz");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Tryb ciemny" }).first().click();
  await expect(page.locator("html")).toHaveAttribute("data-skin", "zeszyt");
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
});
