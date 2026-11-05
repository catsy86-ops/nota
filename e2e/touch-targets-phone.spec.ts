import { test, expect } from "@playwright/test";
import { seedNotes } from "./helpers";

// Plan-nowy 2.8 (Powłoka 3.11): cele dotyku ≥ 44 px na ekranie telefonu, a nie tylko tabletu (`touch-targets.spec.ts`).
// Przegląd wszystkich widocznych elementów do stuknięcia na głównych ekranach — nowy za mały przycisk od razu tu wychodzi.
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

const T = new Date(2026, 9, 14, 12, 0).getTime();
const ROUTES = ["/", "/dzis", "/przypomnienia", "/kalendarz", "/grafik", "/praca", "/dlugi"];

test("telefon 390 px: każdy widoczny przycisk ma cel dotyku co najmniej 44 px @mobile", async ({ page }) => {
  await page.clock.setFixedTime(T);
  // Notatka z terminem: na Dziś i w Terminach pojawiają się przyciski „Gotowe / Jutro / +1 h / ⋯”.
  await seedNotes(page, [{ id: "a", title: "Kafel", content: "Treść", color: "default", pinned: false, archived: false, labels: [], createdAt: T, updatedAt: T, reminder: T + 3600_000 }]);
  const problems: string[] = [];
  for (const route of ROUTES) {
    await page.goto(route);
    await expect(page.locator("main").first()).toBeVisible();
    // Leniwe widoki (Kalendarz, Grafik, Praca) — chwila na wyrenderowanie treści i wejście animacji.
    await page.waitForTimeout(1200);
    const small = await page.evaluate(() => {
      const out: string[] = [];
      for (const el of document.querySelectorAll<HTMLElement>("button, a[href], [role=button], [role=tab], [role=radio], [role=checkbox]")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0 || r.bottom < 0 || r.top > innerHeight) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || cs.opacity === "0" || cs.pointerEvents === "none") continue;
        // Cel dotyku to przycisk plus niewidzialne `::after` wystające poza niego (jak w touch-targets.spec.ts).
        let w = r.width;
        let h = r.height;
        const a = getComputedStyle(el, "::after");
        if (a.content !== "none" && a.position === "absolute") {
          const px = (v: string) => (v.endsWith("px") ? parseFloat(v) : 0);
          w = Math.max(w, r.width - px(a.left) - px(a.right));
          h = Math.max(h, r.height - px(a.top) - px(a.bottom));
        }
        if (Math.round(w) < 44 || Math.round(h) < 44) {
          out.push(`${Math.round(w)}×${Math.round(h)} „${el.getAttribute("aria-label") || el.textContent?.trim().slice(0, 30) || el.tagName}”`);
        }
      }
      return out;
    });
    problems.push(...small.map((s) => `${route}: ${s}`));
  }
  expect(problems, "za małe cele dotyku").toEqual([]);
});
