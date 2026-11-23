import { test, expect, type Page } from "@playwright/test";

// Q3.4 (QL-3): zainstalowana aplikacja wraca do ostatniego działu, a po 4 h przerwy zaczyna od „Dziś”.
const H = 60 * 60 * 1000;

/** Udaje zainstalowaną aplikację (`display-mode: standalone`) i ewentualnie zapisane ostatnie miejsce. */
async function asInstalled(page: Page, lastSeen?: { agoMs: number; path: string }) {
  await page.addInitScript((seen) => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    const real = window.matchMedia.bind(window);
    window.matchMedia = (q: string) => (q.includes("display-mode: standalone")
      ? ({ matches: true, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false } as MediaQueryList)
      : real(q));
    if (seen && !sessionStorage.getItem("seeded")) {
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem("kaczy.lastSeen.v1", JSON.stringify({ at: Date.now() - seen.agoMs, path: seen.path }));
    }
  }, lastSeen ?? null);
}

const setVisibility = (page: Page, state: "hidden" | "visible") => page.evaluate((s) => {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => s });
  document.dispatchEvent(new Event("visibilitychange"));
}, state);

test("zimny start z ikony: po 3 h ostatni dział, po 5 h „Dziś”", async ({ page }) => {
  await asInstalled(page, { agoMs: 3 * H, path: "/kalendarz" });
  await page.goto("/");
  await expect(page).toHaveURL(/\/kalendarz$/);

  // Nowa karta = nowy zimny start (pusta pamięć sesji, więc zapis „5 h temu” trafia do pamięci lokalnej).
  const fresh = await page.context().newPage();
  await asInstalled(fresh, { agoMs: 5 * H, path: "/kalendarz" });
  await fresh.goto("/");
  await expect(fresh).toHaveURL(/\/dzis$/);
});

test("powrót do schowanej aplikacji po 4 h przełącza na „Dziś”; po chwili — zostaje", async ({ page }) => {
  await page.clock.install();
  await asInstalled(page);
  await page.goto("/grafik");
  await expect(page).toHaveURL(/\/grafik$/);

  await setVisibility(page, "hidden");
  await page.clock.fastForward(30 * 60 * 1000);
  await setVisibility(page, "visible");
  await expect(page).toHaveURL(/\/grafik$/);

  await setVisibility(page, "hidden");
  await page.clock.fastForward(4 * H + 60_000);
  await setVisibility(page, "visible");
  await expect(page).toHaveURL(/\/dzis$/);
});

test("w zwykłej karcie przeglądarki adres zostaje, nawet po długiej przerwie", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.lastSeen.v1", JSON.stringify({ at: Date.now() - 9 * 60 * 60 * 1000, path: "/kalendarz" }));
  });
  await page.goto("/");
  await expect(page.getByText("Zapisz notatkę...")).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});
