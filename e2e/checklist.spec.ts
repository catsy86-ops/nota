import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

test("wklejenie wielu linii tworzy osobne pozycje listy", async ({ page }) => {
  await page.getByText("Zapisz notatkę...").click();
  await page.getByRole("button", { name: "Dodaj listę" }).click();
  const input = page.getByPlaceholder("Dodaj element...");
  await input.click();
  // Syntetyczne zdarzenie paste — schowek systemowy bywa niedostępny w headless.
  await input.evaluate((el) => {
    const data = new DataTransfer();
    data.setData("text/plain", "- mleko\n\n* chleb\n- [x] jajka\n");
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await expect(page.getByRole("checkbox", { name: "Odhacz: mleko" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Odhacz: chleb" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Odznacz: jajka" })).toBeVisible();
  await expect(input).toHaveValue("");
});

test("Zamień na listę i z powrotem na tekst w edytorze notatki", async ({ page }) => {
  const title = `Konwersja ${Date.now()}`;
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(title);
  await page.getByPlaceholder("Zapisz notatkę (obsługuje **Markdown**)...").fill("jabłka\ngruszki");
  await page.getByRole("button", { name: "Zamknij" }).click();

  await page.getByText(title).click();
  // W trybie edycji tytuł siedzi w polu, więc kafel szukamy po edytorze.
  const card = page.locator("[data-note-id]").filter({ has: page.locator("textarea") }).first();
  await card.getByRole("button", { name: "Zamień na listę" }).click();
  await expect(card.getByRole("checkbox", { name: "Odhacz: jabłka" })).toBeVisible();
  await expect(card.locator("textarea").first()).toHaveValue("");

  await card.getByRole("checkbox", { name: "Odhacz: gruszki" }).click();
  await card.getByRole("button", { name: "Zamień na tekst" }).click();
  await expect(card.locator("textarea").first()).toHaveValue("- [ ] jabłka\n- [x] gruszki");
  await expect(card.getByRole("checkbox")).toHaveCount(0);
});
