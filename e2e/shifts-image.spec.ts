import { test, expect } from "@playwright/test";
import { SHIFT_TEST_PATTERNS, SHIFT_TEST_TYPES, withLegacyShifts } from "./helpers/shiftSeed";

// G4.7: obraz miesiąca to pokazany miesiąc i następny, z legendą rodzajów i znacznikiem „dziś”.

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-07T10:00:00"));
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await withLegacyShifts(page, { types: SHIFT_TEST_TYPES, patterns: SHIFT_TEST_PATTERNS }, "legacy-seeded-base");
});

test("obraz miesiąca: dwa miesiące w jednym PNG, nazwa z zakresem", async ({ page }) => {
  await page.getByRole("button", { name: /^1 [a-ząćęłńóśźż]+, [a-ząćęłńóśźż]+, wolne$/ }).first().click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Obraz miesiąca (.png)" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("grafik-2026-10_2026-11.png");

  // Nagłówek PNG: szerokość i wysokość są w bajtach 16–23 (big-endian).
  const bytes = Buffer.concat(await (await download.createReadStream()).toArray());
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  expect(width).toBe(1800); // 900 px × skala 2
  // Dwa miesiące to co najmniej dwie sekcje po ~574 px (tytuł, nagłówek, 4 tygodnie, podsumowanie) × 2.
  expect(height).toBeGreaterThanOrEqual(2296);
});
