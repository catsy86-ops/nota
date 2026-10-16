import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

test("lista w edytorze: przyciski w górę/w dół zmieniają kolejność i wyłączają się na krawędzi", async ({ page }) => {
  const title = `E2E-kolejność ${Date.now()}`;
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(title);
  await page.getByPlaceholder("Treść notatki...").fill("jabłka\ngruszki\nśliwki");
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(page.getByText("Zapisz notatkę...")).toBeVisible();

  await page.getByText(title).click();
  await page.getByRole("button", { name: "Zamień na listę" }).click();
  await expect(page.getByLabel("Odhacz: śliwki")).toBeVisible();

  const order = () => page.getByLabel(/^Odhacz: /).evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")?.replace("Odhacz: ", "")));
  expect(await order()).toEqual(["jabłka", "gruszki", "śliwki"]);

  await expect(page.getByRole("button", { name: "Przesuń w górę: jabłka" })).toBeDisabled();
  await page.getByRole("button", { name: "Przesuń w dół: jabłka" }).click();
  expect(await order()).toEqual(["gruszki", "jabłka", "śliwki"]);

  await page.getByRole("button", { name: "Przesuń w górę: śliwki" }).click();
  expect(await order()).toEqual(["gruszki", "śliwki", "jabłka"]);
  await expect(page.getByRole("button", { name: "Przesuń w dół: jabłka" })).toBeDisabled();
});
