import { test, expect } from "@playwright/test";

// 2.3: czwarta pozycja dolnego paska wybierana w Ustawieniach → Wygląd; domyślnie Terminy.
test.use({ viewport: { width: 390, height: 844 } });

test("domyślnie Terminy; wybór Grafiku zmienia prawą pozycję paska", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
  const nav = page.getByRole("navigation").last();
  await expect(nav.getByRole("button", { name: "Terminy", exact: true })).toBeVisible();

  await page.goto("/?settings=wyglad");
  await page.getByRole("radio", { name: "Grafik", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.goto("/");
  const nav2 = page.getByRole("navigation").last();
  await expect(nav2.getByRole("button", { name: "Grafik", exact: true })).toBeVisible();
  await expect(nav2.getByRole("button", { name: "Terminy", exact: true })).toHaveCount(0);
});
