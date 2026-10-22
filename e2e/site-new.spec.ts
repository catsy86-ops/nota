import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded-new-site")) return;
    sessionStorage.setItem("seeded-new-site", "1");
    localStorage.setItem("kaczy.tour.seen.v1", "1");
  });
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Dziennik" }).click();
});

test("dziennik: „Nowa budowa” z samą nazwą otwiera kartę budowy", async ({ page }) => {
  const name = `Osiedle ${Date.now()}`;
  await page.getByRole("button", { name: /Nowa budowa/ }).click();
  await page.getByLabel("Nazwa budowy").fill(name);
  await page.getByRole("button", { name: "Utwórz budowę" }).click();

  await expect(page.getByTestId("site-card")).toBeVisible();
});

test("dziennik: nazwa zajęta przez inną budowę jest odrzucana", async ({ page }) => {
  const name = `Zajęta ${Date.now()}`;
  await page.getByRole("button", { name: /Nowa budowa/ }).click();
  await page.getByLabel("Nazwa budowy").fill(name);
  await page.getByRole("button", { name: "Utwórz budowę" }).click();
  await expect(page.getByTestId("site-card")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: /Nowa budowa/ }).click();
  await page.getByLabel("Nazwa budowy").fill(name.toUpperCase());
  await expect(page.getByRole("alert")).toContainText("Jest już budowa");
  await expect(page.getByRole("button", { name: "Utwórz budowę" })).toBeDisabled();
});
