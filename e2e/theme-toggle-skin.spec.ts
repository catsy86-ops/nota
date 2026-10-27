import { test, expect } from "@playwright/test";

// Plan motywów 4.1 (decyzja M-2): każdy styl ma jasny i ciemny schemat. Przełącznik jasności zmienia schemat
// bieżącego stylu (zastępuje PW-2, gdzie styl z jednym trybem przechodził na Zeszyt z „Cofnij”).
test("przełącznik jasności zmienia schemat stylu, styl zostaje, wybór przeżywa odświeżenie", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    if (!localStorage.getItem("kaczy.skin.v1")) localStorage.setItem("kaczy.skin.v1", JSON.stringify("plan"));
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-skin", "plan");
  await expect(html).toHaveClass(/\bdark\b/);

  await page.getByRole("button", { name: "Tryb ciemny" }).first().click();
  await expect(html).toHaveAttribute("data-skin", "plan");
  await expect(html).not.toHaveClass(/\bdark\b/);
  // Jasny Plan ma własne tło (blok `:not(.dark)`), nie granat.
  const bg = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--background").trim());
  // Przeglądarka zapisuje L w procentach („oklch(96.5% …)”), więc dopuszczamy oba zapisy.
  expect(bg).toMatch(/96\.5%|0\.965/);

  await page.reload();
  await expect(html).toHaveAttribute("data-skin", "plan");
  await expect(html).not.toHaveClass(/\bdark\b/);
});

test("Zeszyt dalej słucha wspólnego przełącznika, a styl pamięta swój wybór osobno", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy-theme", "dark");
    localStorage.setItem("kaczy.skinScheme.v1", JSON.stringify({ neon: "light" }));
    if (!localStorage.getItem("kaczy.skin.v1")) localStorage.setItem("kaczy.skin.v1", JSON.stringify("neon"));
  });
  await page.goto("/");
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
  await page.evaluate(() => localStorage.setItem("kaczy.skin.v1", JSON.stringify("zeszyt")));
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
});
