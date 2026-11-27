import { test, expect } from "@playwright/test";

// 2.4: kropka stanu synchronizacji w nagłówku — tylko gdy urządzenie jest w grupie; stuknięcie otwiera Sync.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test("bez grupy nie ma kropki", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /^Synchronizacja:/ })).toHaveCount(0);
});

test("w grupie jest kropka; stuknięcie otwiera Ustawienia na karcie Synchronizacja", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.sync.v1", JSON.stringify({ enabled: true, code: "ABCD2345EFGH", signaling: [], legacyRoom: false, shortCodeDropped: false }));
  });
  await page.goto("/");
  const dot = page.getByRole("button", { name: /^Synchronizacja:/ });
  await expect(dot).toBeVisible();
  await dot.click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Urządzenia w grupie" })).toBeVisible();
});

test("Q4.1: jeden wskaźnik — napis w nagłówku, offline z godziną, pigułka zapisu nie powtarza synchronizacji", async ({ page, context }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.sync.v1", JSON.stringify({ enabled: true, code: "ABCD2345EFGH", signaling: [], legacyRoom: false, shortCodeDropped: false }));
  });
  await page.goto("/");
  const dot = page.getByRole("button", { name: /^Synchronizacja:/ });
  await expect(dot).toBeVisible();
  await expect(page.getByText("Łączenie z urządzeniami…")).toHaveCount(0);
  await context.setOffline(true);
  await expect(dot).toHaveAttribute("data-tone", "offline");
  await expect(dot).toContainText(/Offline od \d\d:\d\d/);
  // Okno Ustawień ładuje się osobnym plikiem — bez service workera w teście tylko z siecią.
  await context.setOffline(false);
  await dot.click();
  await expect(page.getByRole("dialog").getByTestId("sync-format")).toContainText("Format danych");
});
