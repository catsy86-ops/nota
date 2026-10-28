import { test, expect } from "@playwright/test";

// P2.6 Zużycie materiału w karcie budowy: suma kształtek, cena za sztukę, wartość, CSV i Kopiuj.
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 14, 12, 0).getTime());
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.study.tab.v1", "journal");
    const w = window as unknown as Record<string, unknown>;
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (t: string) => { w.__copied = t; } } });
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      site: "Lipowa 5",
      journal: [
        { id: "a", at: new Date(2026, 9, 10, 9).getTime(), kind: "ok", topic: null, text: "Podejścia", site: "Lipowa 5", checked: [], images: [], fittings: [{ name: "Kolano 16", qty: 12 }, { name: "Trójnik 16", qty: 3 }] },
        { id: "b", at: new Date(2026, 9, 12, 9).getTime(), kind: "ok", topic: null, text: "Piony", site: "Lipowa 5", checked: [], images: [], fittings: [{ name: "Kolano 16", qty: 2 }] },
      ],
    }));
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test("zużycie: suma kształtek, cena za sztukę daje wartość, CSV i Kopiuj", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await page.getByTestId("study-journal").getByRole("button", { name: "Lipowa 5: karta budowy" }).first().click();
  const panel = page.getByTestId("site-card").getByTestId("site-material");
  await expect(panel).toContainText("17 szt.");

  await panel.getByRole("button", { name: /Zużycie materiału/ }).click();
  await expect(panel).toContainText("październik 2026");
  const price = panel.getByLabel("Cena za sztukę: Kolano 16");
  await price.fill("4,50");
  await price.blur();
  await expect(panel).toContainText("63,00 zł");

  const download = page.waitForEvent("download");
  await panel.getByRole("button", { name: "CSV" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("Material - Lipowa 5.csv");
  const fs = await import("node:fs");
  const csv = fs.readFileSync((await file.path())!, "utf8");
  expect(csv).toContain("2026-10;kształtka;Kolano 16;14;4,50;63,00");

  await panel.getByRole("button", { name: "Kopiuj" }).click();
  await expect(page.getByText("Skopiowano zużycie materiału")).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __copied: string }).__copied)).toContain("- Kolano 16: 14 szt. × 4,50 zł = 63,00 zł");
});
