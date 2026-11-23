import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

// S1.5(b): kod synchronizacji i QR są ukryte, dopóki użytkownik nie kliknie „Pokaż kod i QR”.

const CODE = "ABCD2345EFGH";

test.beforeEach(async ({ page }) => {
  await page.addInitScript((code) => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    if (!sessionStorage.getItem("seeded")) {
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem("kaczy.sync.v1", JSON.stringify({ enabled: true, code, signaling: [], legacyRoom: false, v2Until: null }));
    }
  }, CODE);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Ustawienia" }).first().click();
  await page.getByRole("tab", { name: "Sync" }).click();
});

test("kod i QR są ukryte do kliknięcia, „Ukryj kod” je chowa", async ({ page }) => {
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Pokaż kod i QR" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Kopiuj kod" })).toHaveCount(0);
  await expect(dialog.locator("svg[role='img'], .bg-white svg")).toHaveCount(0);
  // Kod nie może być w drzewie strony, dopóki nie został pokazany (ani w grupach po 4, ani w całości).
  await expect(dialog).not.toContainText(CODE.slice(0, 4));

  await dialog.getByRole("button", { name: "Pokaż kod i QR" }).click();
  await expect(dialog.getByRole("button", { name: "Kopiuj kod" })).toBeVisible();
  await expect(dialog).toContainText(CODE.slice(0, 4));
  const axe = await new AxeBuilder({ page }).include("[role='dialog']").withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);

  await dialog.getByRole("button", { name: "Ukryj kod" }).click();
  await expect(dialog.getByRole("button", { name: "Pokaż kod i QR" })).toBeVisible();
  await expect(dialog).not.toContainText(CODE.slice(0, 4));
});

test("kod chowa się, gdy karta przechodzi w tło", async ({ page }) => {
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Pokaż kod i QR" }).click();
  await expect(dialog.getByRole("button", { name: "Kopiuj kod" })).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(dialog.getByRole("button", { name: "Pokaż kod i QR" })).toBeVisible();
});
