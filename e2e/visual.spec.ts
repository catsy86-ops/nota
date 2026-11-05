import { test, expect, type Page } from "@playwright/test";
import { seedNotes } from "./helpers";
import { SKINS } from "../src/lib/skinList";

// Zrzuty referencyjne głównych widoków (plan UI/UX 2026-10-25, Faza 0.1): 5 widoków × wszystkie style × 2 rozmiary.
// Plan wyglądu 2026-11-01, Faza 0: pozostałe działy (EXTRA_VIEWS) i edytor Planów w trzech wariantach
// (Zeszyt jasny i ciemny, Hydraulika) — wszystkie style dla każdego działu to byłoby ~180 zrzutów więcej.
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

const EXTRA_VIEWS = [
  { name: "dzis", path: "/dzis" },
  { name: "skrzynka", path: "/skrzynka" },
  { name: "tydzien", path: "/tydzien" },
  { name: "archiwum", path: "/archiwum" },
  { name: "kosz", path: "/kosz" },
  { name: "dlugi", path: "/dlugi" },
  { name: "cwiczenia", path: "/cwiczenia" },
  { name: "plany", path: "/plany" },
] as const;

const EXTRA_LOOKS = [
  { skin: "zeszyt", theme: "light" },
  { skin: "zeszyt", theme: "dark" },
  { skin: "hydraulika", theme: "light" },
] as const;

const SIZES = [
  { name: "komputer", viewport: { width: 1440, height: 900 }, mobile: false },
  { name: "telefon", viewport: { width: 390, height: 844 }, mobile: true },
] as const;


const FIXED_NOW = new Date("2026-10-14T12:00:00");
const T = FIXED_NOW.getTime();

async function prepare(page: Page, skin: string, theme: "light" | "dark", { seed = true } = {}) {
  await page.clock.setFixedTime(FIXED_NOW);
  // `seed: false` — pierwsze uruchomienie: bez notatek i bez odhaczonego przewodnika (nowyplan 0.2).
  if (seed) await seedNotes(page, [
    { id: "vis-1", title: "Zakupy", content: "Mleko, chleb, jajka", color: "default", pinned: true, archived: false, labels: ["dom"], createdAt: T, updatedAt: T },
    { id: "vis-2", title: "Budowa", content: "Zamówić beton na poniedziałek", color: "sky", pinned: false, archived: false, labels: [], createdAt: T, updatedAt: T },
    { id: "vis-3", title: "Piwo", content: "Piątek po pracy", color: "peach", pinned: false, archived: false, labels: [], createdAt: T, updatedAt: T },
  ]);
  await page.addInitScript(([s, t]) => {
    localStorage.setItem("kaczy.skin.v1", JSON.stringify(s));
    localStorage.setItem("kaczy-theme", t);
    localStorage.setItem("kaczy.motion.v1", "reduced");
  }, [skin, theme]);
  // Zrzut `fullPage` w Chromium na chwilę zmienia okno na 1×1: `useIsMobile` widział wtedy telefon i zamykał
  // pasek boczny, a pod obciążeniem zrzut łapał go zwiniętego (Plan-nowy 1.2). Okno w tych testach jest stałe,
  // więc zapytania mediów zostają przy pierwszym odczycie (motyw i ruch ustawia `emulateMedia` przed `goto`).
  await page.addInitScript(() => {
    const real = window.matchMedia.bind(window);
    const frozen = new Map<string, boolean>();
    window.matchMedia = (query: string) => {
      if (!frozen.has(query)) frozen.set(query, real(query).matches);
      const matches = frozen.get(query)!;
      return {
        matches, media: query, onchange: null,
        addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
        dispatchEvent: () => false,
      } as MediaQueryList;
    };
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
}

async function settle(page: Page) {
  await expect(page.locator("main").first()).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".view-skeleton")).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  // Toasty (odznaka „Pierwszy krok”, „Zapisano”) nie są częścią widoku — ukryte stylem, bez usuwania węzłów sonnera.
  await page.addStyleTag({ content: "[data-sonner-toaster]{display:none!important}" });
  // Krój stylu dociągany przy pierwszym malowaniu (Barlow, Fraunces…) — chwila na dorysowanie.
  await page.waitForTimeout(800);
}

async function shoot(page: Page, name: string) {
  await expect(page).toHaveScreenshot(name, {
    fullPage: true,
    animations: "disabled",
    // Kanwa Matrixa (deszcz znaków) i inne płótna animują się mimo ograniczonego ruchu — maskowane.
    mask: [page.locator("[data-visual-mask], canvas")],
    maxDiffPixelRatio: 0.01,
  });
}

/** PNG „planu” w stylu zrzutu z DWG FastView: czarne tło, białe ściany, rura w kolorze, opisy. */
async function planPng(page: Page): Promise<Buffer> {
  const b64 = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 1600; c.height = 900;
    const x = c.getContext("2d")!;
    x.fillStyle = "#000"; x.fillRect(0, 0, 1600, 900);
    x.strokeStyle = "#e0e0e0"; x.lineWidth = 10; x.strokeRect(100, 80, 1400, 740);
    x.beginPath(); x.moveTo(700, 80); x.lineTo(700, 820); x.stroke();
    x.strokeStyle = "#2196f3"; x.lineWidth = 5;
    x.beginPath(); x.moveTo(150, 760); x.lineTo(650, 760); x.lineTo(650, 250); x.lineTo(1200, 250); x.stroke();
    x.fillStyle = "#fff"; x.font = "28px sans-serif"; x.fillText("Ø16 ZW", 300, 745); x.fillText("Salon", 300, 400);
    return c.toDataURL("image/png").split(",")[1];
  });
  return Buffer.from(b64, "base64");
}

// Nowy plan 0.2: pulpitowe działy na szerokim ekranie — tu widać, czy treść ma limit szerokości.
test.describe("wygląd @visual szeroki", () => {
  test.use({ viewport: { width: 1920, height: 1080 } });
  for (const look of EXTRA_LOOKS) {
    const tag = `${look.skin}-${look.theme}`;
    for (const view of [{ name: "dzis", path: "/dzis" }, { name: "kalendarz", path: "/kalendarz" }]) {
      test(`${view.name} 1920 — ${tag} @visual`, async ({ page }) => {
        await prepare(page, look.skin, look.theme);
        await page.goto(view.path);
        await settle(page);
        await shoot(page, `${view.name}-szeroki-${tag}.png`);
      });
    }
  }
});

for (const size of SIZES) {
  test.describe(`wygląd @visual ${size.name}`, () => {
    test.use({ viewport: size.viewport, isMobile: size.mobile, hasTouch: size.mobile });

    for (const skin of SKINS) {
      for (const view of VIEWS) {
        test(`${view.name} — ${skin} @visual`, async ({ page }) => {
          await prepare(page, skin, "light");
          await page.goto(view.path);
          await settle(page);
          await shoot(page, `${view.name}-${size.name}-${skin}.png`);
        });
      }
    }

    // Nowy plan 0.1: główne działy także w ciemnym Zeszycie (reszta stylów tylko jasno).
    for (const view of VIEWS) {
      test(`${view.name} — zeszyt-dark @visual`, async ({ page }) => {
        await prepare(page, "zeszyt", "dark");
        await page.goto(view.path);
        await settle(page);
        await shoot(page, `${view.name}-${size.name}-zeszyt-dark.png`);
      });
    }

    for (const look of EXTRA_LOOKS) {
      const tag = `${look.skin}-${look.theme}`;
      for (const view of EXTRA_VIEWS) {
        test(`${view.name} — ${tag} @visual`, async ({ page }) => {
          await prepare(page, look.skin, look.theme);
          await page.goto(view.path);
          await settle(page);
          await shoot(page, `${view.name}-${size.name}-${tag}.png`);
        });
      }

      // Nowy plan 2026-11-05, Etap 0.2: brakujące wzorce — okna, stany i ekrany poza działami.
      for (const card of ["wyglad", "ogolne", "kopia", "sync"]) {
        test(`ustawienia-${card} — ${tag} @visual`, async ({ page }) => {
          await prepare(page, look.skin, look.theme);
          await page.goto(`/?settings=${card}`);
          await expect(page.getByRole("dialog", { name: "Ustawienia" })).toBeVisible();
          await settle(page);
          await shoot(page, `ustawienia-${card}-${size.name}-${tag}.png`);
        });
      }

      test(`notatka-otwarta — ${tag} @visual`, async ({ page }) => {
        await prepare(page, look.skin, look.theme);
        await page.goto("/");
        await settle(page);
        await page.locator("[data-note-id-wrap]").filter({ hasText: "Budowa" }).getByRole("heading", { name: "Budowa" }).click();
        // Telefon: okno edytora; komputer: edycja w miejscu kafla — w obu jest pole „Tytuł” z treścią.
        await expect(page.getByRole("textbox", { name: "Tytuł" }).first()).toHaveValue("Budowa");
        await settle(page);
        await shoot(page, `notatka-otwarta-${size.name}-${tag}.png`);
      });

      test(`paleta — ${tag} @visual`, async ({ page }) => {
        await prepare(page, look.skin, look.theme);
        await page.goto("/");
        await settle(page);
        await page.keyboard.press("Control+k");
        await expect(page.getByRole("dialog").getByPlaceholder(/szukaj|wpisz|polec/i)).toBeVisible();
        await settle(page);
        await shoot(page, `paleta-${size.name}-${tag}.png`);
      });

      test(`skarbiec — ${tag} @visual`, async ({ page }) => {
        await prepare(page, look.skin, look.theme);
        await page.goto("/");
        await settle(page);
        const card = page.locator("[data-note-id]").filter({ hasText: "Piwo" });
        if (!size.mobile) await card.hover();
        await card.getByRole("button", { name: "Więcej opcji" }).click();
        // Telefon: akcje kafla są w arkuszu poza kaflem — szukane na całej stronie.
        await page.getByRole("button", { name: "Zablokuj (notatka prywatna)" }).click();
        await expect(page.getByRole("dialog", { name: "Ustaw hasło skarbca" })).toBeVisible();
        await settle(page);
        await shoot(page, `skarbiec-${size.name}-${tag}.png`);
      });

      test(`pierwsze-uruchomienie — ${tag} @visual`, async ({ page }) => {
        await prepare(page, look.skin, look.theme, { seed: false });
        await page.goto("/");
        await settle(page);
        await shoot(page, `pierwsze-uruchomienie-${size.name}-${tag}.png`);
      });

      test(`szukanie-pusto — ${tag} @visual`, async ({ page }) => {
        await prepare(page, look.skin, look.theme);
        await page.goto("/");
        await settle(page);
        await page.getByRole("searchbox", { name: "Szukaj w notatkach" }).fill("kalafior");
        await expect(page.locator("[data-note-id]")).toHaveCount(0);
        await page.getByRole("searchbox", { name: "Szukaj w notatkach" }).blur();
        await settle(page);
        await shoot(page, `szukanie-pusto-${size.name}-${tag}.png`);
      });

      if (size.mobile) {
        test(`wiecej — ${tag} @visual`, async ({ page }) => {
          await prepare(page, look.skin, look.theme);
          await page.goto("/");
          await settle(page);
          await page.getByRole("button", { name: /^Więcej(: .+)?$/ }).click();
          await expect(page.getByRole("dialog", { name: "Więcej" })).toBeVisible();
          await settle(page);
          await shoot(page, `wiecej-${size.name}-${tag}.png`);
        });
      }

      test(`plany-edytor — ${tag} @visual`, async ({ page }) => {
        await prepare(page, look.skin, look.theme);
        await page.goto("/plany");
        await page.getByRole("button", { name: "Nowa analiza" }).click();
        const dialog = page.getByTestId("plan-new");
        await dialog.getByTestId("plan-file").setInputFiles({ name: "Parter.png", mimeType: "image/png", buffer: await planPng(page) });
        await dialog.getByRole("button", { name: "Utwórz analizę" }).click();
        await expect(page.getByTestId("plan-canvas")).toHaveAttribute("data-tx", /\d/);
        await settle(page);
        await shoot(page, `plany-edytor-${size.name}-${tag}.png`);
      });
    }
  });
}
