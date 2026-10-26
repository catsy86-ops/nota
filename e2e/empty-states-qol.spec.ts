import { test, expect } from "@playwright/test";

// Puste stany (QoL): pusty wynik wyszukiwania ma „Wyczyść wyszukiwanie”; pusty widok ma „Nowa notatka”.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
});

test("pusty wynik wyszukiwania: „Wyczyść wyszukiwanie” przywraca listę", async ({ page }) => {
  await page.goto("/");
  const search = page.getByPlaceholder(/zukaj/i).first();
  await search.fill("qwertyxyz");
  await expect(page.getByText(/Brak wyników/).first()).toBeVisible();
  await page.getByTestId("empty-clear-search").click();
  await expect(search).toHaveValue("");
});

test("pusty Archiwum: „Nowa notatka” otwiera kompozytor", async ({ page }) => {
  await page.goto("/archiwum");
  await page.getByRole("button", { name: "Nowa notatka" }).first().click();
  await expect(page.getByPlaceholder("Tytuł")).toBeVisible();
});

test("pusta lista Notatek: jeden przycisk „Nowa notatka” (N-3)", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Zacznij tworzyć").first()).toBeVisible();
  await page.getByRole("button", { name: "Nowa notatka" }).first().click();
  await expect(page.getByPlaceholder("Tytuł")).toBeVisible();
});
