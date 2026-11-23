import { test, expect } from "@playwright/test";

// M4.1 (RU-1): zmiana działu przenika treść z dryfem w stronę zakładki; nagłówek i dolny pasek stoją.
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test.beforeEach(async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "View Transitions tylko w Chromium (WebKit wyłączony w viewTransition.ts)");
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    const seen: Record<string, unknown>[] = [];
    (window as unknown as { __vt: typeof seen }).__vt = seen;
    const start = document.startViewTransition?.bind(document);
    if (!start) return;
    document.startViewTransition = ((cb: () => void) => {
      const t = start(cb);
      // Po zrzucie starego stanu: nazwy powłoki i animacje pseudo-elementów `::view-transition-*`.
      void t.ready.then(() => {
        const name = (sel: string) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).viewTransitionName : null; };
        seen.push({
          dir: document.documentElement.dataset.vtDir ?? null,
          header: name(".app-header"),
          nav: name("[data-shell-nav]"),
          anims: document.getAnimations().map((a) => {
            const fx = a.effect as KeyframeEffect | null;
            return `${fx?.pseudoElement ?? ""} ${(a as CSSAnimation).animationName ?? ""}`.trim();
          }),
        });
      });
      return t;
    }) as typeof document.startViewTransition;
  });
});

const nav = (page: import("@playwright/test").Page) => page.locator("[data-shell-nav]");

test("przenikanie w przód i wstecz, powłoka stoi @mobile", async ({ page }) => {
  await page.goto("/");
  await nav(page).getByRole("link", { name: "Dziś" }).or(nav(page).getByRole("button", { name: "Dziś" })).first().click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __vt: unknown[] }).__vt.length)).toBe(1);
  await nav(page).getByRole("link", { name: "Notatki" }).or(nav(page).getByRole("button", { name: "Notatki" })).first().click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __vt: unknown[] }).__vt.length)).toBe(2);
  const [fwd, back] = await page.evaluate(() => (window as unknown as { __vt: { dir: string; header: string; nav: string; anims: string[] }[] }).__vt);

  expect(fwd.dir).toBe("fwd");
  expect(back.dir).toBe("back");
  for (const t of [fwd, back]) {
    expect(t.header).toBe("app-header");
    expect(t.nav).toBe("app-nav");
    expect(t.anims).toContain("::view-transition-old(root) vt-section-out");
    // Powłoka bez własnej animacji ruchu.
    expect(t.anims.filter((a) => /app-header|app-nav/.test(a) && /vt-/.test(a))).toEqual([]);
  }
  expect(fwd.anims).toContain("::view-transition-new(root) vt-section-in-fwd");
  expect(back.anims).toContain("::view-transition-new(root) vt-section-in-back");

  // Po przejściu nazwy zdjęte — przejście motywu dalej obejmuje cały ekran.
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector(".app-header")!).viewTransitionName)).toBe("none");
});

test("ograniczony ruch: zmiana działu bez przejścia widoku @mobile", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await nav(page).getByRole("link", { name: "Dziś" }).or(nav(page).getByRole("button", { name: "Dziś" })).first().click();
  await expect(page).toHaveURL(/dzis|today/);
  expect(await page.evaluate(() => (window as unknown as { __vt: unknown[] }).__vt.length)).toBe(0);
});
