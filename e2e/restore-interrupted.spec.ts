import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

// Z-18.1: znacznik przerwanego przywracania → baner przy starcie; „Zostaw, jak jest” go zdejmuje.

test("przerwane przywracanie: baner z datą kopii, bez uwag axe, „Zostaw, jak jest” zdejmuje znacznik", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    if (!sessionStorage.getItem("seeded")) {
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem("kaczy.restore.running.v1", JSON.stringify({ startedAt: Date.now(), exportedAt: new Date(2026, 10, 17).getTime() }));
    }
  });
  await page.goto("/");
  const banner = page.getByTestId("restore-interrupted");
  await expect(banner).toContainText("Przywracanie kopii z 17.11 zostało przerwane");
  const axe = await new AxeBuilder({ page }).include('[data-testid="restore-interrupted"]').withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);

  await banner.getByRole("button", { name: "Kopia i dane" }).click();
  await expect(page.getByRole("tab", { name: "Kopia i dane" })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Escape");

  await banner.getByRole("button", { name: "Zostaw, jak jest" }).click();
  await expect(banner).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("kaczy.restore.running.v1"))).toBeNull();
  await page.reload();
  await expect(page.getByTestId("restore-interrupted")).toHaveCount(0);
});
