import { test, expect } from "@playwright/test";

// Ramki: kolor krawędzi i tło kart w Ustawieniach → Wygląd. Wybór działa na <html> i zostaje po odświeżeniu.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
  await page.getByRole("button", { name: "Ustawienia" }).first().click();
  await page.getByRole("tab", { name: "Wygląd" }).click();
});

test("kolor krawędzi i tło kart zmieniają się i zostają po odświeżeniu", async ({ page }) => {
  const border = page.getByRole("radiogroup", { name: "Kolor krawędzi" });
  const surface = page.getByRole("radiogroup", { name: "Tło kart" });

  await border.getByRole("radio", { name: "Błękit" }).click();
  await expect(border.getByRole("radio", { name: "Błękit" })).toHaveAttribute("aria-checked", "true");
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue("--border"))).toContain("#2563eb");

  await surface.getByRole("radio", { name: "Miętowe" }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue("--card"))).toContain("oklch");

  await page.reload();
  await page.getByRole("button", { name: "Ustawienia" }).first().click();
  await page.getByRole("tab", { name: "Wygląd" }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue("--border"))).toContain("#2563eb");
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue("--card"))).toContain("oklch");

  // „Motyw” zdejmuje nadpisanie i wraca do kolorów skórki.
  await border.getByRole("radio", { name: "Motyw" }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue("--border"))).toBe("");
});
