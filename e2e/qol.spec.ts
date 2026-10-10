import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

test("sekwencja „g, k” przechodzi do kosza, a „g, n” wraca do notatek", async ({ page }) => {
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("g");
  await page.keyboard.press("k");
  await expect(page).toHaveURL(/\/kosz$/);
  await page.keyboard.press("g");
  await page.keyboard.press("n");
  await expect(page).not.toHaveURL(/\/kosz$/);
});

test("„g” w polu tekstowym nie uruchamia nawigacji", async ({ page }) => {
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").click();
  await page.keyboard.type("gk");
  await expect(page).not.toHaveURL(/\/kosz$/);
});

test("wklejony adres w pusty szkic daje tytuł z domeny", async ({ page }) => {
  await page.getByText("Zapisz notatkę...").click();
  const body = page.getByPlaceholder(/Zapisz notatkę \(/);
  await body.focus();
  await body.evaluate((el) => {
    const dt = new DataTransfer();
    dt.setData("text/plain", "https://www.example.com/artykul?id=1");
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await expect(page.getByPlaceholder("Tytuł")).toHaveValue("example.com");
  await expect(body).toHaveValue("https://www.example.com/artykul?id=1");
});

test("paleta pamięta ostatnie zapytanie po otwarciu notatki", async ({ page }) => {
  const title = `Zebra ${Date.now() % 100000}`;
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(title);
  await page.getByRole("button", { name: "Zamknij" }).click();
  await expect(page.getByText(title)).toBeVisible();

  await page.keyboard.press("Control+k");
  const input = page.getByRole("dialog").getByPlaceholder(/Szukaj/i);
  await input.fill("Zebra");
  await page.getByRole("dialog").getByRole("option", { name: new RegExp(title) }).click();

  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Ostatnio szukane")).toBeVisible();
  await expect(dialog.getByRole("option", { name: "Zebra", exact: true })).toBeVisible();
});
