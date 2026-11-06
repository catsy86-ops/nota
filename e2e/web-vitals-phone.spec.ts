import { test, expect, type Page } from "@playwright/test";
import { seedNotes } from "./helpers";

// Plan-nowy 3.3: pomiar reakcji na telefonie jako stały test z progiem. LCP (największy element
// na pierwszym ekranie) i najdłuższa interakcja (uproszczony INP, jak w `src/lib/perfProbe.ts`).
// Obserwatory wstrzykujemy w teście — w aplikacji nie ma kodu pomiarowego, więc paczka się nie zmienia.
// Progi: LCP ≤ 2500 ms („dobry” Web Vitals). Interakcja ≤ 300 ms — straż regresji, nie cel: pomiar 2026-11-05
// (Pixel 7 w Playwright, bez dławienia CPU) to LCP ok. 1,1–1,8 s, wyszukiwanie i przełączanie widoków 40–104 ms,
// a najwolniejsze jest otwarcie notatki stuknięciem w kafel (ok. 170–360 ms).
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

const NOW = new Date(2026, 10, 5, 12, 0).getTime();
const NOTES = Array.from({ length: 120 }, (_, i) => ({
  id: `n${i}`, title: `Notatka ${i}`, content: `Treść notatki numer ${i} z kilkoma słowami do wyszukania`, color: "default",
  pinned: false, archived: false, labels: i % 3 ? [] : ["dom"], createdAt: NOW - i * 60_000, updatedAt: NOW - i * 60_000,
}));

type Vitals = { lcp: number; worst: number; worstName: string };

async function installObservers(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __vitals: Vitals };
    w.__vitals = { lcp: 0, worst: 0, worstName: "" };
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) w.__vitals.lcp = Math.max(w.__vitals.lcp, e.startTime);
      }).observe({ type: "largest-contentful-paint", buffered: true });
    } catch { /* brak LCP w przeglądarce */ }
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as Array<PerformanceEntry & { interactionId?: number }>) {
          // Jak prawdziwy INP: tylko zdarzenia z `interactionId` (stuknięcie, klawisz), bez `pointerover`/`mouseout`.
          if (!e.interactionId) continue;
          if (e.duration > w.__vitals.worst) { w.__vitals.worst = e.duration; w.__vitals.worstName = e.name; }
        }
      }).observe({ type: "event", buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
    } catch { /* brak Event Timing */ }
  });
}

const vitals = (page: Page) => page.evaluate(() => (window as unknown as { __vitals: Vitals }).__vitals);

// Jeden przebieg: świeże załadowanie strony (obserwatory z `installObservers` działają od pierwszego dokumentu),
// rozgrzewka edytora, potem typowe stuknięcia. Zwraca LCP i najdłuższą interakcję tego przebiegu.
async function measureOnce(page: Page): Promise<{ lcp: number; worst: number; worstName: string }> {
  await page.goto("/");
  await expect(page.locator("[data-note-id-wrap]").first()).toBeVisible();
  // LCP zamyka się przy pierwszej interakcji — odczyt przed nią.
  await page.waitForTimeout(800);
  const { lcp } = await vitals(page);

  // Rozgrzewka: pierwsze otwarcie notatki montuje edytor (jednorazowy koszt) — to osobne znalezisko w opis.md.
  // Mierzymy stan ustalony: po rozgrzewce zerujemy rekord.
  await page.locator("[data-note-id-wrap]").nth(1).getByRole("heading").tap();
  await page.waitForTimeout(600);
  await page.goBack();
  await expect(page.locator("[data-note-id-wrap]").first()).toBeVisible();
  await page.waitForTimeout(400);
  await page.evaluate(() => { (window as unknown as { __vitals: Vitals }).__vitals.worst = 0; });

  // Typowe stuknięcia: wyszukiwanie, przejście do Dziś i z powrotem, otwarcie notatki.
  await page.getByRole("searchbox").first().tap();
  await page.keyboard.type("numer 5", { delay: 40 });
  await page.waitForTimeout(400);
  await page.getByRole("searchbox").first().fill("");
  await page.getByRole("button", { name: "Dziś", exact: true }).first().tap();
  await expect(page).toHaveURL(/\/dzis/);
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Notatki", exact: true }).first().tap();
  await expect(page.locator("[data-note-id-wrap]").first()).toBeVisible();
  await page.locator("[data-note-id-wrap]").first().getByRole("heading").tap();
  await page.waitForTimeout(600);
  const { worst, worstName } = await vitals(page);
  return { lcp, worst, worstName };
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// Pomiar niestabilny pojedynczo (2026-11-05: najdłuższa interakcja 240–360 ms, raz LCP 10,6 s na obciążonej maszynie),
// więc bierzemy medianę z RUNS przebiegów. Próg dotyczy mediany, nie pojedynczego przebiegu.
const RUNS = 5;

test("telefon: LCP listy notatek i najdłuższa interakcja w dobrych granicach @mobile", async ({ page, browserName }) => {
  // INP i LCP to metryki Chromium (Event Timing API); WebKit (iPhone w Playwright) mierzy je niewiarygodnie.
  test.skip(browserName !== "chromium", "INP i LCP mierzymy na Chromium (pixel-7)");
  test.setTimeout(RUNS * 60_000);
  await page.clock.setFixedTime(NOW);
  await installObservers(page);
  await seedNotes(page, NOTES);

  const runs: Array<{ lcp: number; worst: number; worstName: string }> = [];
  for (let i = 0; i < RUNS; i++) runs.push(await measureOnce(page));

  const lcp = median(runs.map((r) => r.lcp));
  const worst = median(runs.map((r) => r.worst));
  const worstName = runs[Math.floor(RUNS / 2)].worstName;
  console.log(
    `[vitals] ${RUNS} przebiegów; mediana LCP ${Math.round(lcp)} ms, najdłuższa interakcja ${Math.round(worst)} ms (${worstName}); ` +
      `wszystkie interakcje: ${runs.map((r) => Math.round(r.worst)).join(", ")} ms`,
  );
  expect(lcp, "mediana LCP listy notatek na telefonie").toBeGreaterThan(0);
  expect(lcp, "mediana LCP listy notatek na telefonie").toBeLessThan(2500);
  expect(worst, `mediana najdłuższej interakcji (${worstName})`).toBeLessThan(300);
});
