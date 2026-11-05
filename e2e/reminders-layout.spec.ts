import { test, expect } from "@playwright/test";

// 2.6: Terminy przełączają się między kaflami a listą; wybór zostaje po odświeżeniu (per urządzenie).
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test("Terminy: „Lista” zapamiętuje się po odświeżeniu, „Kafle” wraca", async ({ page }) => {
  await page.goto("/przypomnienia");
  const group = page.getByRole("radiogroup", { name: "Układ Terminów" });
  await group.getByRole("radio", { name: "Lista" }).click();
  await expect(group.getByRole("radio", { name: "Lista" })).toHaveAttribute("aria-checked", "true");
  await page.reload();
  await expect(page.getByRole("radiogroup", { name: "Układ Terminów" }).getByRole("radio", { name: "Lista" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("radiogroup", { name: "Układ Terminów" }).getByRole("radio", { name: "Kafle" }).click();
  await expect(page.getByRole("radiogroup", { name: "Układ Terminów" }).getByRole("radio", { name: "Kafle" })).toHaveAttribute("aria-checked", "true");
});
