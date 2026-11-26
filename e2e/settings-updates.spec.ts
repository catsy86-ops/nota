import { test, expect } from "@playwright/test";

// Ustawienia → Ogólne → „Aktualizacje”: „Odśwież aktualizacje” i przełącznik auto-aktualizacji (2026-11-26).

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("iphone") || testInfo.project.name.includes("pixel"), "service worker zablokowany w projektach telefonu");
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test("„Odśwież aktualizacje” sprawdza wersję; auto-aktualizacja domyślnie włączona i zapamiętana", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.getByRole("group", { name: "Szybkie akcje" }).getByRole("button", { name: "Ustawienia" }).click();
  await page.getByRole("tab", { name: "Ogólne" }).click();

  await expect(page.getByRole("heading", { name: "Aktualizacje" })).toBeVisible();
  const refresh = page.getByTestId("settings-refresh-update");
  await expect(refresh).toHaveText(/Odśwież aktualizacje/);
  await refresh.click();
  await expect(page.getByText("Masz najnowszą wersję")).toBeVisible();

  const toggle = page.getByRole("switch", { name: "Aktualizuj automatycznie" });
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  expect(await page.evaluate(() => localStorage.getItem("kaczy.autoUpdate.v1"))).toBe("false");
});
