import { test, expect } from "@playwright/test";

// Plan motywów 2026-10-30, Fala 1: Wygląd w „Szybko” i zwiniętych „Zaawansowanych”, podgląd na żywo,
// „Przywróć domyślny wygląd” bez przeładowania i z „Cofnij”.

test.use({ isMobile: true, hasTouch: true, viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

async function openAppearance(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Więcej", exact: true }).click();
  await page.getByRole("button", { name: "Ustawienia" }).click();
  await page.getByRole("tab", { name: "Wygląd" }).click();
}

test("Szybko na górze, Zaawansowane zwinięte i zapamiętane, podgląd na żywo @mobile", async ({ page }) => {
  await openAppearance(page);
  await expect(page.getByTestId("appearance-preview")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Galeria stylów" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Poświata" })).toHaveCount(0);
  const more = page.getByRole("button", { name: /^Pokaż: kształt/ });
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await more.click();
  await expect(page.getByRole("heading", { name: "Poświata" })).toBeVisible();

  // Pora roku: ikony, nie emoji.
  await expect(page.getByRole("button", { name: "Lato" })).not.toContainText("☀");

  await page.reload();
  await openAppearance(page);
  await expect(page.getByRole("button", { name: /^Zwiń: kształt/ })).toHaveAttribute("aria-expanded", "true");
});

test("Przywróć domyślny wygląd: bez przeładowania, z „Cofnij” @mobile", async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem("kaczy.skin.v1", JSON.stringify("neon"));
    localStorage.setItem("kaczy.shape.v1", JSON.stringify("soft"));
  });
  await page.reload();
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-skin", "neon");
  await expect(html).toHaveAttribute("data-shape", "soft");

  await openAppearance(page);
  await page.getByRole("button", { name: "Przywróć domyślny wygląd" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Przywróć" }).click();
  await expect(html).toHaveAttribute("data-skin", "zeszyt");
  await expect(html).not.toHaveAttribute("data-shape", /.+/);
  await page.getByRole("button", { name: "Cofnij" }).click();
  await expect(html).toHaveAttribute("data-skin", "neon");
  await expect(html).toHaveAttribute("data-shape", "soft");
});
