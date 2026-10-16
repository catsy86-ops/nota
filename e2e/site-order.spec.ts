import { test, expect, type Page } from "@playwright/test";

// „Do zamówienia” w karcie budowy: kształtki od ostatniego zamówienia, kopia listy, zaznaczenie zamówienia.

async function reloadWhenSaved(page: Page) {
  await expect(page.getByText("Zapisano", { exact: true })).toBeVisible();
  await page.reload();
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 14, 12, 0).getTime());
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.study.tab.v1", "journal");
    const w = window as unknown as Record<string, unknown>;
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (t: string) => { w.__copied = t; } } });
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    const entry = (id: string, h: number, site: string, fittings: { name: string; qty: number }[]) => ({
      id, at: new Date(2026, 9, 13, h).getTime(), kind: "ok", topic: null, text: "Montaż", site, checked: [], images: [], fittings,
    });
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      site: "Lipowa 5",
      journal: [
        entry("a", 8, "Lipowa 5", [{ name: "Kolano 16", qty: 3 }, { name: "Trójnik 16", qty: 1 }]),
        entry("b", 9, "Lipowa 5", [{ name: "kolano 16", qty: 2 }]),
        entry("obca", 10, "Polna 2", [{ name: "Kolano 16", qty: 9 }]),
      ],
    }));
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test("do zamówienia: suma budowy, kopia listy, oznaczenie zamówienia zeruje listę i zostaje po przeładowaniu", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Dziennik" }).click();
  const journal = page.getByTestId("study-journal");
  await journal.getByRole("button", { name: "Lipowa 5: karta budowy" }).click();

  const card = page.getByTestId("site-card");
  const order = card.getByTestId("site-order");
  const rows = order.getByTestId("site-order-items").locator("li");
  // Sumy bez wielkości liter; wpis „Polna 2” nie wchodzi.
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("Kolano 16");
  await expect(rows.nth(0)).toContainText("5 szt.");
  await expect(rows.nth(1)).toContainText("Trójnik 16");
  await expect(rows.nth(1)).toContainText("1 szt.");

  await order.getByRole("button", { name: "Kopiuj listę" }).click();
  const copied = await page.evaluate(() => (window as unknown as { __copied: string }).__copied);
  expect(copied).toContain("Zamówienie kształtek — Lipowa 5");
  expect(copied).toContain("- Kolano 16: 5 szt.\n- Trójnik 16: 1 szt.");

  await order.getByRole("button", { name: "Oznacz jako zamówione" }).click();
  await expect(order.getByText(/^Nic do zamówienia/)).toBeVisible();
  await expect(order.getByRole("button", { name: "Kopiuj listę" })).toBeDisabled();
  await expect(order.getByRole("button", { name: "Oznacz jako zamówione" })).toBeDisabled();

  await reloadWhenSaved(page);
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await page.getByTestId("study-journal").getByRole("button", { name: "Lipowa 5: karta budowy" }).click();
  await expect(page.getByTestId("site-card").getByTestId("site-order").getByText(/^Nic do zamówienia od ostatniego zamówienia/)).toBeVisible();
});
