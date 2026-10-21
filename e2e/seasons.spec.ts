import { test, expect, type Page } from "@playwright/test";

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

async function openAppearance(page: Page) {
  await page.getByRole("button", { name: "Ustawienia" }).first().click();
  await page.getByRole("tab", { name: "Wygląd" }).click();
}

const washOf = (page: Page) =>
  page.locator(".paper-grid").evaluate((el) => getComputedStyle(el, "::after").backgroundImage);

test("motyw pory roku: wybrane Lato działa od razu i maluje tło Zeszytu", async ({ page }) => {
  await openAppearance(page);
  await page.getByRole("button", { name: "Lato", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-season", "summer");
  expect(await washOf(page)).toContain("radial-gradient");

  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-season", "summer");
  expect(await washOf(page)).toContain("radial-gradient");
});

test("motyw pory roku nie maluje tła w stylu Plan (ma własne kolory)", async ({ page }) => {
  await openAppearance(page);
  await page.getByRole("button", { name: "Zima", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-season", "winter");
  expect(await washOf(page)).toContain("radial-gradient");

  await page.locator('[data-skin-option="plan"]').click();
  await page.keyboard.press("Escape");
  expect(await washOf(page)).toBe("none");
});

test("krój tekstu w Zeszycie zmienia też tytuł aplikacji i nagłówki", async ({ page }) => {
  await openAppearance(page);
  await page.locator('[data-font-option="lexend"]').click();
  await page.keyboard.press("Escape");
  const title = page.locator(".app-title").first();
  await expect(title).toHaveCSS("font-family", /Lexend/);
  await expect(page.locator("h2").first()).toHaveCSS("font-family", /Lexend/);
});
