import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

test("menu „/” wstawia nagłówek i zadanie w nowej notatce", async ({ page }) => {
  await page.getByText("Zapisz notatkę...").click();
  const body = page.getByPlaceholder("Treść notatki...");
  await body.click();

  await body.pressSequentially("/naglo");
  const menu = page.getByRole("listbox", { name: "Wstaw blok" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("option")).toHaveCount(3);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(menu).toBeHidden();
  await expect(body).toHaveValue("## ");

  await body.pressSequentially("Plan\n/zad");
  await page.keyboard.press("Enter");
  await expect(body).toHaveValue("## Plan\n- [ ] ");
});

test("Esc chowa menu „/”, a adres z ukośnikami go nie otwiera", async ({ page }) => {
  await page.getByText("Zapisz notatkę...").click();
  const body = page.getByPlaceholder("Treść notatki...");
  await body.click();

  await body.pressSequentially("/kod");
  const menu = page.getByRole("listbox", { name: "Wstaw blok" });
  await expect(menu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(body).toHaveValue("/kod");

  await body.fill("");
  await body.pressSequentially("https://example.com/kod");
  await expect(menu).toBeHidden();
});

test("menu „/” działa też przy edycji istniejącej notatki", async ({ page }) => {
  const title = `Slash ${Date.now()}`;
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(title);
  await page.getByRole("button", { name: "Zamknij" }).click();
  await expect(page.getByText("Zapisz notatkę...")).toBeVisible();

  await page.getByText(title).click();
  const body = page.getByPlaceholder("Treść notatki...");
  await body.click();
  await body.pressSequentially("/cyt");
  await expect(page.getByRole("listbox", { name: "Wstaw blok" })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(body).toHaveValue("> ");
});
