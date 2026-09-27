// Deterministic before/after screenshots of the main views.
// Usage: node scripts/screenshots.mjs <baseUrl> <outDir>
// e.g.   node scripts/screenshots.mjs http://localhost:4173 shots/after
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const [base = "http://localhost:4173", out = "shots/current"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });

const NOTES = ["Lista zakupów", "Pomysł na weekend", "Spotkanie z zespołem", "Przeczytać: Shape Up"];
const viewports = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };

const browser = await chromium.launch();
for (const [vpName, viewport] of Object.entries(viewports)) {
  for (const scheme of ["light", "dark"]) {
    const ctx = await browser.newContext({ viewport, colorScheme: scheme, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
    await page.goto(base);
    const tag = `${vpName}-${scheme}`;

    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}/${tag}-empty.png` });

    for (const title of NOTES) {
      await page.getByText("Zapisz notatkę...").click();
      await page.getByPlaceholder("Tytuł").fill(title);
      await page.getByRole("button", { name: "Zamknij" }).click();
    }
    await page.mouse.move(0, 0);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}/${tag}-notes.png` });
    await ctx.close();
  }
}
await browser.close();
console.log(`Saved to ${out}`);
