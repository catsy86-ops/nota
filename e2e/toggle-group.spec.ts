import { test, expect } from "@playwright/test";

// Grupy „jedna z kilku” na `ui/toggle-group.tsx` (Radix): jeden przystanek Tab,
// strzałki przenoszą fokus, Spacja wybiera, kliknięcie wybranej jej nie odznacza.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

test("Tryb budowa: strzałki i Spacja, bez odznaczania", async ({ page }) => {
  const html = page.locator("html");
  await page.getByRole("button", { name: "Ustawienia" }).first().click();
  await page.getByRole("tab", { name: "Wygląd" }).click();

  const group = page.getByRole("radiogroup", { name: "Tryb budowa" });
  const off = group.getByRole("radio", { name: "Wyłączony" });
  const on = group.getByRole("radio", { name: "Włączony" });
  await expect(off).toHaveAttribute("aria-checked", "true");
  // Jeden przystanek Tab: pozycje mają tabindex -1, fokus na grupie trafia na wybraną.
  await expect(on).toHaveAttribute("tabindex", "-1");
  await group.focus();
  await expect(off).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(on).toBeFocused();
  await expect(on).toHaveAttribute("aria-checked", "false");
  await page.keyboard.press("Space");
  await expect(on).toHaveAttribute("aria-checked", "true");
  await expect(html).toHaveAttribute("data-site", "");

  await on.click();
  await expect(on).toHaveAttribute("aria-checked", "true");
  await expect(html).toHaveAttribute("data-site", "");
});
