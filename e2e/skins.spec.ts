import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (localStorage.setItem("kaczy.tour.seen.v1", "1"), localStorage.setItem("kaczy.appearance.advanced.v1", "1"));
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

test("styl Neon: ciemne kolory domyślnie, jasność per styl, wybór przeżywa odświeżenie @smoke", async ({ page }) => {
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-skin", "zeszyt");
  await expect(html).not.toHaveClass(/\bdark\b/);

  await openAppearance(page);
  const neon = page.locator('[data-skin-option="neon"]');
  await neon.click();
  await expect(neon).toHaveAttribute("aria-checked", "true");
  await expect(html).toHaveAttribute("data-skin", "neon");
  // Neon powstał jako ciemny — bez wyboru zostaje ciemny, mimo jasnego Zeszytu (plan motywów 4.1).
  await expect(html).toHaveClass(/\bdark\b/);
  const brightness = page.getByRole("radiogroup", { name: "Jasność" });
  await expect(brightness.getByRole("radio", { name: "Ciemny" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("Każdy styl pamięta własną jasność.", { exact: false })).toBeVisible();

  await page.reload();
  await expect(html).toHaveAttribute("data-skin", "neon");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#130a1b");
});

test("jasność w stylu: Neon jasny ma własny kolor paska, Zeszyt zostaje przy swojej jasności", async ({ page }) => {
  await openAppearance(page);
  await page.locator('[data-skin-option="neon"]').click();
  await page.getByRole("radiogroup", { name: "Jasność" }).getByRole("radio", { name: "Jasny" }).click();
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-skin", "neon");
  await expect(html).not.toHaveClass(/\bdark\b/);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#f5f0f5");

  await page.locator('[data-skin-option="zeszyt"]').click();
  await expect(html).not.toHaveClass(/\bdark\b/);
});

test("przełącznik jasny/ciemny w nagłówku zmienia schemat stylu, nie styl", async ({ page }) => {
  await openAppearance(page);
  await page.locator('[data-skin-option="miedz"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-skin", "miedz");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Tryb ciemny" }).first().click();
  await expect(page.locator("html")).toHaveAttribute("data-skin", "miedz");
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
});

test("krój tekstu: Literata zmienia tekst; w stylu Plan nagłówki zostają w kroju stylu", async ({ page }) => {
  await openAppearance(page);
  await page.locator('[data-font-option="literata"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-font", "literata");
  const bodyFont = () => page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(await bodyFont()).toContain("Literata");

  await page.locator('[data-skin-option="plan"]').click();
  await page.keyboard.press("Escape");
  const h1Font = await page.locator("h1").first().evaluate((el) => getComputedStyle(el).fontFamily);
  expect(h1Font).toContain("Barlow Condensed");
  expect(await bodyFont()).toContain("Literata");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-font", "literata");
});
