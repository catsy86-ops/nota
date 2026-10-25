import { test, expect } from "@playwright/test";
import { seedNotes } from "./helpers";

// Zrzuty referencyjne głównych widoków (plan UI/UX 2026-10-25, Faza 0.1): 5 widoków × 7 stylów × 2 rozmiary.
// Tag @visual — poza codziennym `test:e2e`, uruchamia `npm run test:visual` (playwright.visual.config.ts).
// Zegar zamrożony na dzień roboczy przed 17:00 (bez dymku „raport gotowy”), animacje wyłączone,
// cytat dnia ukryty przez `data-visual-mask`. Zrzuty są zależne od systemu — bazowe robi się na tym samym OS.

const VIEWS = [
  { name: "notatki", path: "/" },
  { name: "przypomnienia", path: "/przypomnienia" },
  { name: "kalendarz", path: "/kalendarz" },
  { name: "grafik", path: "/grafik" },
  { name: "praca", path: "/praca" },
] as const;

const SIZES = [
  { name: "komputer", viewport: { width: 1440, height: 900 }, mobile: false },
  { name: "telefon", viewport: { width: 390, height: 844 }, mobile: true },
] as const;

const SKINS = ["zeszyt", "plan", "neon", "zorza", "miedz", "matrix", "hydraulika"] as const;

const FIXED_NOW = new Date("2026-10-14T12:00:00");
const T = FIXED_NOW.getTime();

for (const size of SIZES) {
  test.describe(`wygląd @visual ${size.name}`, () => {
    test.use({ viewport: size.viewport, isMobile: size.mobile, hasTouch: size.mobile });

    for (const skin of SKINS) {
      for (const view of VIEWS) {
        test(`${view.name} — ${skin} @visual`, async ({ page }) => {
          await page.clock.setFixedTime(FIXED_NOW);
          await seedNotes(page, [
            { id: "vis-1", title: "Zakupy", content: "Mleko, chleb, jajka", color: "default", pinned: true, archived: false, labels: ["dom"], createdAt: T, updatedAt: T },
            { id: "vis-2", title: "Budowa", content: "Zamówić beton na poniedziałek", color: "sky", pinned: false, archived: false, labels: [], createdAt: T, updatedAt: T },
            { id: "vis-3", title: "Piwo", content: "Piątek po pracy", color: "peach", pinned: false, archived: false, labels: [], createdAt: T, updatedAt: T },
          ]);
          await page.addInitScript((s) => {
            localStorage.setItem("kaczy.skin.v1", JSON.stringify(s));
            localStorage.setItem("kaczy-theme", "light");
            localStorage.setItem("kaczy.motion.v1", "reduced");
          }, skin);
          await page.emulateMedia({ reducedMotion: "reduce" });
          await page.goto(view.path);
          await expect(page.locator("main").first()).toBeVisible();
          await page.waitForLoadState("networkidle");
          await expect(page.locator(".view-skeleton")).toHaveCount(0);
          await page.evaluate(() => document.fonts.ready);
          // Krój stylu dociągany przy pierwszym malowaniu (Barlow, Fraunces…) — chwila na dorysowanie.
          await page.waitForTimeout(800);

          await expect(page).toHaveScreenshot(`${view.name}-${size.name}-${skin}.png`, {
            fullPage: true,
            animations: "disabled",
            // Kanwa Matrixa (deszcz znaków) i inne płótna animują się mimo ograniczonego ruchu — maskowane.
            mask: [page.locator("[data-visual-mask], canvas")],
            maxDiffPixelRatio: 0.01,
          });
        });
      }
    }
  });
}
