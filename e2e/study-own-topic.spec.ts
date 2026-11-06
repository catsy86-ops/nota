import { test, expect } from "@playwright/test";

// P4.6 (v1): własny temat nauki — dodanie nazwy, ćwiczenie (przycisk „Ćwicz”) i usunięcie.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
});

test("własny temat: dodanie, widoczny na liście, usunięcie z listy", async ({ page }) => {
  await page.goto("/praca");
  const own = page.getByRole("region", { name: "Moje tematy" });
  await own.getByLabel("Nazwa nowego tematu").fill("Pompy ciepła");
  await own.getByRole("button", { name: "Dodaj temat" }).click();

  await expect(own.getByText("Pompy ciepła", { exact: true })).toBeVisible();
  await expect(own.getByRole("button", { name: "Ćwicz temat: Pompy ciepła" })).toBeVisible();

  await own.getByRole("button", { name: "Usuń temat: Pompy ciepła" }).click();
  await expect(own.getByText("Pompy ciepła", { exact: true })).toHaveCount(0);
});
