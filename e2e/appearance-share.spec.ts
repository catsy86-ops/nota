import { test, expect } from "@playwright/test";

// Kod i link wyglądu (plan motywów 2026-10-30, 1.5): wczytanie bez przeładowania z „Cofnij”;
// link `#wyglad=` pyta przed zmianą i czyści fragment z adresu.

test.use({ isMobile: true, hasTouch: true, viewport: { width: 390, height: 844 } });

// Kod z zestawem „Neon” — taki, jaki zwróciłoby „Kopiuj kod wyglądu” na innym telefonie.
const NEON_CODE = "NOTKI1-" + Buffer.from(JSON.stringify({ "kaczy.skin.v1": JSON.stringify("neon") }), "utf8").toString("base64url");

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.appearance.advanced.v1", "1");
  });
});

test("wczytanie kodu stosuje wygląd bez przeładowania i cofa się @mobile", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => { (window as unknown as { __mark: number }).__mark = 42; });
  await page.getByRole("button", { name: "Więcej", exact: true }).click();
  await page.getByRole("button", { name: "Ustawienia" }).click();
  await page.getByRole("tab", { name: "Wygląd" }).click();
  await page.getByLabel("Kod wyglądu").fill(NEON_CODE);
  await page.getByRole("button", { name: "Wczytaj", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-skin", "neon");
  expect(await page.evaluate(() => (window as unknown as { __mark?: number }).__mark)).toBe(42);
  await page.getByRole("button", { name: "Cofnij" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-skin", "zeszyt");
});

test("link #wyglad= pyta przed zmianą; „Nie” nic nie zmienia; fragment znika z adresu @mobile", async ({ page }) => {
  const link = `/#wyglad=${encodeURIComponent(NEON_CODE)}`;
  await page.goto(link);
  const dialog = page.getByRole("alertdialog", { name: "Wczytać wygląd z linku?" });
  await expect(dialog).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-skin", "zeszyt");
  await expect(page).toHaveURL(/\/$/);
  await dialog.getByRole("button", { name: "Nie, zostaw" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-skin", "zeszyt");

  // Nowa karta: zmiana samego fragmentu nie montuje aplikacji od nowa.
  const second = await page.context().newPage();
  await second.goto(link);
  await second.getByRole("alertdialog").getByRole("button", { name: "Wczytaj wygląd" }).click();
  await expect(second.locator("html")).toHaveAttribute("data-skin", "neon");
  await expect(page.locator("html")).toHaveAttribute("data-skin", "neon");
});
