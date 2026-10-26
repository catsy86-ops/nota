import { test, expect } from "@playwright/test";

// PW-2: w stylu z jednym trybem przełącznik jasności nie zmienia stylu po cichu —
// przełącza na Zeszyt z komunikatem, a „Cofnij” przywraca poprzedni styl.
test("styl z jednym trybem: przełącznik jasności przełącza na Zeszyt, „Cofnij” wraca", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.skin.v1", JSON.stringify("plan"));
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-skin", "plan");

  await page.getByRole("button", { name: "Tryb ciemny" }).first().click();
  await expect(page.locator("html")).toHaveAttribute("data-skin", "zeszyt");
  await expect(page.getByText("Ten styl ma jeden tryb — przełączono na Zeszyt")).toBeVisible();

  await page.getByRole("button", { name: "Cofnij" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-skin", "plan");
});
