import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";
import { seedNotes } from "./helpers";

// Automatyczny audyt dostępności (axe-core, WCAG 2.2 AA) głównych widoków
// w obu motywach, na telefonie i komputerze. Zapadka: znane naruszenia są
// w KNOWN — nowe naruszenie wywraca test, a naprawione trzeba z KNOWN usunąć,
// więc lista może tylko maleć.

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const VIEWS = [
  { name: "notatki", path: "/" },
  { name: "przypomnienia", path: "/przypomnienia" },
  { name: "kalendarz", path: "/kalendarz" },
  { name: "grafik", path: "/grafik" },
  { name: "nauka", path: "/nauka" },
] as const;

const SIZES = [
  { name: "390", viewport: { width: 390, height: 844 }, mobile: true },
  { name: "1440", viewport: { width: 1440, height: 900 }, mobile: false },
] as const;

const THEMES = ["light", "dark"] as const;

/**
 * Znane naruszenia: klucz `widok/rozmiar/motyw` → identyfikatory reguł axe. Każde z uzasadnieniem.
 * - nauka/390 target-size: komórki paska opanowania (`StudyView.tsx`) są węższe niż 24 px przy
 *   kilkunastu tematach w module. Te same tematy i ich stan są na tablicy poniżej — wyjątek
 *   „równoważna kontrolka” z WCAG 2.5.8; komórka ma 26 px wysokości celu.
 */
const KNOWN: Record<string, string[]> = {
  "nauka/390/light": ["target-size"],
  "nauka/390/dark": ["target-size"],
};

async function scan(page: Page): Promise<string[]> {
  const result = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  // Log zostaje: przy wywróconym teście od razu widać regułę i element.
  for (const v of result.violations) {
    console.log(`[a11y] ${test.info().titlePath.slice(-2).join(" · ")} | ${v.id} (${v.impact}): ${v.nodes.length}× — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  }
  return result.violations.map((v) => v.id).sort();
}

for (const size of SIZES) {
  test.describe(`a11y ${size.name}`, () => {
    test.use({ viewport: size.viewport, isMobile: size.mobile, hasTouch: size.mobile });

    for (const theme of THEMES) {
      for (const view of VIEWS) {
        test(`${view.name} — ${theme}`, async ({ page }) => {
          await seedNotes(page, [
            { id: "a11y-1", title: "Zakupy", content: "Mleko, chleb", color: "default", pinned: true, archived: false, labels: [], createdAt: Date.now(), updatedAt: Date.now() },
            { id: "a11y-2", title: "Budowa", content: "Zamówić beton", color: "yellow", pinned: false, archived: false, labels: [], createdAt: Date.now(), updatedAt: Date.now() },
          ]);
          await page.addInitScript((t) => {
            localStorage.setItem("kaczy-theme", t);
            localStorage.setItem("kaczy.motion.v1", "reduced");
          }, theme);
          await page.emulateMedia({ reducedMotion: "reduce", colorScheme: theme });
          await page.goto(view.path);
          await expect(page.locator("main").first()).toBeVisible();
          await page.waitForLoadState("networkidle");
          await expect(page.locator(".view-skeleton")).toHaveCount(0);

          const found = await scan(page);
          const known = (KNOWN[`${view.name}/${size.name}/${theme}`] ?? []).slice().sort();
          expect(found, "nowe albo naprawione naruszenia — popraw kod albo listę KNOWN").toEqual(known);
        });
      }
    }
  });
}
