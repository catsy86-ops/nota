import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-07T10:00:00"));
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/grafik");
});

// Nagłówki dni tygodnia i komórki dni muszą leżeć w tych samych kolumnach — inaczej daty „uciekają” spod nagłówków.
test("siatka miesiąca na telefonie: nagłówki i komórki w tych samych kolumnach @mobile", async ({ page }) => {
  await expect(page.getByRole("grid")).toBeVisible();
  const columns = await page.evaluate(() => {
    const grid = document.querySelector('[role="grid"]');
    const rows = grid ? Array.from(grid.querySelectorAll('[role="row"]')) : [];
    const cols = (row: Element | undefined) => Array.from(row?.children ?? []).map((e) => {
      const r = e.getBoundingClientRect();
      return { left: Math.round(r.left), width: Math.round(r.width) };
    });
    return { head: cols(rows[0]), first: cols(rows[1]) };
  });
  expect(columns.head).toHaveLength(7);
  expect(columns.first).toHaveLength(7);
  columns.head.forEach((h, i) => {
    expect(Math.abs(h.left - columns.first[i].left), `kolumna ${i + 1}: lewa krawędź`).toBeLessThanOrEqual(1);
    expect(Math.abs(h.width - columns.first[i].width), `kolumna ${i + 1}: szerokość`).toBeLessThanOrEqual(1);
  });
});
