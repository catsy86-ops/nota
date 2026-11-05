import { test, expect } from "@playwright/test";
import { seedNotes } from "./helpers";

// Plan-nowy 2.8 (QoL 3.9 / Notatki 2.5): paleta przy otwartej notatce ma jej akcje — te same co na kaflu, z „Cofnij”.
const T = new Date(2026, 9, 14, 12, 0).getTime();
const note = (id: string, title: string) => ({ id, title, content: `Treść ${title}`, color: "default", pinned: false, archived: false, labels: [], createdAt: T, updatedAt: T });

test("paleta: „Ta notatka” — do ulubionych i archiwizacja otwartej notatki z Cofnij", async ({ page }) => {
  await page.clock.setFixedTime(T);
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedNotes(page, [note("a", "Alfa")]);
  await page.goto("/");
  const reader = page.getByRole("dialog", { name: "Alfa" });
  await expect(async () => {
    await page.locator("body").click({ position: { x: 1200, y: 860 } });
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press(" ");
    await expect(reader).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 15000 });

  await page.keyboard.press("Control+k");
  const group = page.getByRole("group", { name: "Ta notatka" });
  await group.getByRole("option", { name: "Do ulubionych" }).click();
  await expect(page.locator("[data-favorites]")).toContainText("Alfa");

  await page.keyboard.press("Control+k");
  await page.getByRole("group", { name: "Ta notatka" }).getByRole("option", { name: "Archiwizuj" }).click();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-note-id-wrap]", { hasText: "Alfa" })).toHaveCount(0);
  await page.locator("[data-sonner-toast]").getByRole("button", { name: "Cofnij" }).click();
  await expect(page.locator("[data-note-id-wrap]", { hasText: "Alfa" })).toHaveCount(1);
});
