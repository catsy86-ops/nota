import { test, expect } from "@playwright/test";

// Galeria stylów (plan motywów 2026-10-30, 3.5): Matryca schowana pod „Więcej stylów”, widoczna po
// rozwinięciu albo od razu, gdy jest wybrana.

test.use({ viewport: { width: 1280, height: 800 } });

async function openGallery(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Ustawienia" }).first().click();
  await page.getByRole("tab", { name: "Wygląd" }).click();
}

test("Matryca pod „Więcej stylów”, rozwijana kliknięciem @smoke", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.skin.v1", JSON.stringify("zeszyt"));
  });
  await page.goto("/");
  await openGallery(page);
  const matrix = page.locator('[data-skin-option="matrix"]');
  await expect(matrix).toHaveCount(0);
  await page.getByRole("button", { name: /^Więcej stylów/ }).click();
  await expect(matrix).toBeVisible();
});

test("wybrana Matryca widoczna od razu po otwarciu galerii @smoke", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.skin.v1", JSON.stringify("matrix"));
  });
  await page.goto("/");
  await openGallery(page);
  await expect(page.locator('[data-skin-option="matrix"]')).toBeVisible();
});
