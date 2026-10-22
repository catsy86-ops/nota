import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test("ćwiczenia: własne ćwiczenie dodaje się do listy i da się je usunąć, gdy nie ma wpisów", async ({ page }) => {
  const name = `Pompki testowe ${Date.now()}`;
  await page.goto("/cwiczenia");
  await page.getByRole("button", { name: "+ Nowe ćwiczenie" }).click();
  const form = page.getByRole("group", { name: "Nowe ćwiczenie" });
  await form.getByLabel("Nazwa ćwiczenia").fill(name);
  await form.getByRole("button", { name: "Dodaj ćwiczenie" }).click();

  const select = page.getByRole("combobox", { name: "Ćwiczenie" });
  await expect(select).toHaveValue(/^wlasne-/);
  await expect(select.locator("option", { hasText: name })).toHaveCount(1);

  await page.getByRole("button", { name: "Usuń to ćwiczenie" }).click();
  await expect(select.locator("option", { hasText: name })).toHaveCount(0);
});
