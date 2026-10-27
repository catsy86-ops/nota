import { test, expect } from "@playwright/test";

// Styl na noc (plan motywów 1.4): para styl dzienny / nocny przełączana o zadanej porze.
test("harmonogram obejmujący bieżącą porę przełącza na styl nocny zaraz po starcie", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-27T22:30:00"));
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.skin.v1", JSON.stringify("zeszyt"));
    localStorage.setItem("kaczy.skinSchedule.v1", JSON.stringify({ enabled: true, day: "zeszyt", night: "neon", mode: "hours", from: "20:00", to: "07:00" }));
  });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-skin", "neon");
});

test("włączenie w Ustawieniach zapisuje bieżący styl jako dzienny", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-27T12:00:00"));
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
  await page.getByRole("button", { name: "Ustawienia" }).first().click();
  await page.getByRole("tab", { name: "Wygląd" }).click();
  await page.getByRole("switch", { name: "Inny styl wieczorem" }).click();
  await expect(page.getByLabel("Styl nocny")).toHaveValue("zorza");
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("kaczy.skinSchedule.v1") ?? "{}"));
  expect(saved).toEqual(expect.objectContaining({ enabled: true, day: "zeszyt", night: "zorza" }));
  // Południe: zostaje styl dzienny.
  await expect(page.locator("html")).toHaveAttribute("data-skin", "zeszyt");
});
