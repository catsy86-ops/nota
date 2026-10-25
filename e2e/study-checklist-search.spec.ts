import { test, expect } from "@playwright/test";

// Szukanie na liście kontrolnej Nauki (4.5 planu Praca 2026-10-24): bez polskich znaków i bez wielkości liter.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
});

test("lista kontrolna: „szczelnosc” znajduje punkt ze „szczelności”, a bez trafień mówi wprost", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Lista kontrolna" }).click();
  const search = page.getByRole("searchbox", { name: "Szukaj na liście kontrolnej" });
  await search.fill("szczelnosc");
  await expect(page.getByText("Próba szczelności na zalanie wodą", { exact: false })).toBeVisible();
  await expect(page.getByText("Tuleja nasunięta DO OPORU")).toHaveCount(0);

  await search.fill("zzzzbrak");
  await expect(page.getByText("Nic nie pasuje do „zzzzbrak”.")).toBeVisible();
});
