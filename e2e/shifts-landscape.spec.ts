import { test, expect } from "@playwright/test";

// Telefon w poziomie (niski ekran dotykowy, wariant `short:`): przełącznik widoku i miesiąc w jednym rzędzie,
// paleta w jednym przewijanym rzędzie, podpowiedzi schowane — siatka bliżej góry.
test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });

test("Grafik w poziomie na telefonie: miesiąc obok przełącznika, paleta w jednym rzędzie, bez podpowiedzi @mobile", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/grafik");

  const toggle = page.getByRole("group", { name: "Widok Grafiku" });
  const month = page.getByTitle("Wróć do bieżącego miesiąca");
  await expect(month).toBeVisible();
  const [t, m] = [await toggle.boundingBox(), await month.boundingBox()];
  expect(Math.abs((t!.y + t!.height / 2) - (m!.y + m!.height / 2))).toBeLessThan(12);

  await expect(page.locator("#shift-brush-hint")).toBeHidden();

  const chips = page.getByRole("radiogroup", { name: "Zmiana do naniesienia" }).getByRole("radio");
  const first = await chips.first().boundingBox();
  const last = await chips.last().boundingBox();
  expect(Math.abs(first!.y - last!.y)).toBeLessThan(4);
});
