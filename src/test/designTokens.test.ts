import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Strażnik systemu projektowego (plan UI/UX 2026-10-25, Faza 0.3): liczy surowe klasy,
// które Faza 1 ma zastąpić tokenami — promienie `rounded-md/lg/xl/3xl`, cienie `shadow-md/lg/2xl`
// i warstwy `z-10…z-70` wpisywane ręcznie. Progi to stan z dnia wprowadzenia testu.
// Faza 1 obniża je w miarę codemodów; liczba nie może rosnąć, więc nowy kod bierze tokeny.
// 2026-10-27 (plan motywów 0.1): progi = stan po codemodach. Zostało 11 `rounded-sm` — elementy
// wewnątrz kontrolek (pozycje menu, zakładki, checkbox, pieczątka), liczone od `--radius` w
// tailwind.config.ts, więc idą za kształtem motywu; nowe miejsca biorą `rounded-control`.

const SRC = resolve(process.cwd(), "src");

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return name.endsWith(".tsx") ? [path] : [];
  });
}

const SOURCES = tsxFiles(SRC).map((path) => ({ path, text: readFileSync(path, "utf8") }));

function count(pattern: RegExp): number {
  return SOURCES.reduce((sum, { text }) => sum + (text.match(pattern)?.length ?? 0), 0);
}

const LIMITS = {
  // Lookbehind/lookahead, żeby `rounded-lg` nie łapało np. `my-rounded-lg-x`, a `z-10` nie łapało `fz-10`.
  rawRadius: { pattern: /(?<![\w-])rounded-(?:lg|xl|md|sm|3xl)(?![\w-])/g, max: 11, token: "rounded-field / rounded-card / rounded-control" },
  rawShadow: { pattern: /(?<![\w-])shadow-(?:md|lg|2xl)(?![\w-])/g, max: 0, token: "shadow-elevation-1..3" },
  rawZIndex: { pattern: /(?<![\w-])z-\d+(?![\w-])/g, max: 0, token: "z-sticky / z-dropdown / z-overlay / z-modal / z-toast" },
  // Plan UI 2026-11-06, 1.7: progi = stan z 2026-11-06; Etapy 2 i 5 je obniżają.
  // Rozmiar tekstu w px/rem omija skalę i `--text-scale`.
  pxText: { pattern: /(?<![\w-])text-\[\d+(?:\.\d+)?(?:px|rem)\]/g, max: 0, token: "text-2xs / text-xs / text-sm" },
  // Etap 2: opis w akapicie to `.ui-hint` (14 px). Zostały wydruki (raport, protokół), kafle i linijki z `truncate`.
  smallHintParagraph: { pattern: /<p\b[^>]*className="(?=[^"]*\btext-xs\b)(?=[^"]*\btext-muted-foreground\b)[^"]*"/g, max: 24, token: "ui-hint / ui-meta" },
  // Goły `rounded` (0.25rem) nie idzie za kształtem motywu (`--shape`).
  bareRadius: { pattern: /(?<![\w-])rounded(?![\w-[])/g, max: 38, token: "rounded-control / rounded-field" },
  // `shadow` i `shadow-sm` to dwie nazwy na `--elevation-1`.
  // W1.3: jedna skala cieni — `shadow`, `shadow-sm`, `shadow-xl` to tylko aliasy elewacji.
  bareShadow: { pattern: /(?<![\w-])shadow(?:-sm|-xl)?(?![\w-[])/g, max: 0, token: "shadow-elevation-1..3" },
  // `shadow-[…]` tylko na obwódki, wcięcia i poświaty (suwak, przycisk wciśnięty, dzień, chip, podpis) — nie na głębię.
  arbitraryShadow: { pattern: /(?<![\w-])shadow-\[/g, max: 7, token: "shadow-elevation-1..3" },
  // W1.1: tekst wyciszony przez przezroczystość nie ma sprawdzanego kontrastu. Został nieaktywny `IconButton`.
  mutedAlpha: { pattern: /text-muted-foreground\/\d+/g, max: 1, token: "text-faint" },
  // Zmienna `--radius-*` nie istnieje — promienie to `--r-control/field/card`.
  missingRadiusVar: { pattern: /var\(--radius-/g, max: 0, token: "var(--r-field) itd." },
  // Blady przycisk wygląda na zepsuty (nowy plan 2.4) — nieaktywny szarzeje kolorem.
  // W2.7: para rozmiar + grubość składana ręcznie zamiast roli (`title-card`, `title-section`, `ui-meta`).
  // Próg = stan z 2026-11-19 (233) po migracji etykiet na `ui-label` i nagłówków na `section-caps`; W2.3 i migracje działów go obniżają.
  sizeWeightPair: { pattern: /className="(?=[^"]*(?<![\w-])text-(?:xs|sm)(?![\w-]))(?=[^"]*(?<![\w-])font-(?:medium|semibold)(?![\w-]))[^"]*"/g, max: 168, token: "title-card / title-section / ui-meta" },
  // W2.5: interlinia idzie z roli i rozmiaru. Zostają wyjątki: pigułki i znaczki (`leading-4/5/none`),
  // tytuły display (`tight/snug`), czytana treść (`relaxed`). Próg = stan z 2026-11-19 po przeglądzie.
  manualLeading: { pattern: /(?<![\w-])leading-(?:none|tight|snug|normal|relaxed|loose|\d+)(?![\w-])/g, max: 91, token: "rola tekstu (title-*, ui-*, text-sm)" },
  // W4.1: kwadrat to `size-N`, nie para `h-N w-N` (zamienione mechanicznie 2026-11-19, 1103 miejsca).
  squarePair: { pattern: /(?<![\w:\-[])(?:h-(\d+(?:\.5)?) w-\1|w-(\d+(?:\.5)?) h-\2)(?![\w.-])/g, max: 0, token: "size-3.5 / size-4 / size-5" },
  // W3.5: rozmycie tylko na paskach przyklejonych, pływającym pasku zaznaczenia i tle pod arkuszem (stan 2026-11-19).
  backdropBlur: { pattern: /(?<![\w-])backdrop-blur(?:-[\w[\]]+)?(?![\w-])/g, max: 9, token: "pełne tło (bg-card / bg-background)" },
  // W3.6: gradient w klasie tylko z treścią (spód pod napisem na zdjęciu); dekoracja idzie przez `signatures.css` stylu.
  classGradient: { pattern: /(?<![\w-])bg-(?:linear|radial|conic|gradient)-/g, max: 1, token: "signatures.css stylu" },
  disabledOpacity: { pattern: /(?<![\w-])disabled:opacity-\d+/g, max: 30, token: "disabled:text-muted-foreground / Button" },
} as const;

// W6.3: `.dark` idzie za schematem stylu (`useTheme`), ale kolor ma wynikać z tokenu, nie z pary jasny/ciemny.
// Zostają: dzień w Kalendarzu (obrys i tło z `--primary` mocniejsze na ciemnym) i `dark:prose-invert` w czytniku.
const DARK_OUTSIDE_UI_MAX = 8;

describe("W6.3 — `dark:` poza components/ui", () => {
  it(`co najwyżej ${DARK_OUTSIDE_UI_MAX} wystąpień (zamiast tego: token stylu)`, () => {
    const n = SOURCES.filter(({ path }) => !/[\\/]components[\\/]ui[\\/]/.test(path))
      .reduce((sum, { text }) => sum + (text.match(/(?<![\w-])dark:[^\s"'`]+/g)?.length ?? 0), 0);
    expect(n).toBeLessThanOrEqual(DARK_OUTSIDE_UI_MAX);
  });
});

// W3.2: karta poza `components/ui/` to `<Card variant>` albo `cardVariant()`, nie ręczne `rounded-card … border`
// ani goły `cardClass`. Próg = stan po Długach, Pracy, Ustawieniach (2026-11-19), Grafiku, Dziś, Kalendarzu i części Notatek (2026-11-20); maleje z resztą Notatek i pojedynczymi komponentami.
const MANUAL_CARD_MAX = 50;
const manualCard = /(?<![\w-])rounded-card(?![\w-])[^"'`\n]*?(?<![\w:-])border(?![\w-])|\bcardClass\b(?! =)/g;
describe("W3.2 — ręczne karty poza components/ui", () => {
  it(`co najwyżej ${MANUAL_CARD_MAX} (zamiast tego: Card variant / cardVariant())`, () => {
    const n = SOURCES.filter(({ path }) => !/[\\/]components[\\/]ui[\\/]/.test(path))
      // Nie karty: ramka przerywana (miejsce na „dodaj”, pusty stan) i ramka podglądu kamery/obrazu.
      .map(({ text }) => text.replace(/^import .*$/gm, "").replace(/"[^"\n]*(?:border-dashed|object-(?:cover|contain))[^"\n]*"/g, '""'))
      .reduce((sum, text) => sum + (text.match(manualCard)?.length ?? 0), 0);
    expect(n).toBeLessThanOrEqual(MANUAL_CARD_MAX);
  });
});

// W4.5: surowe `<button>` w dziale = tylko jawne wyjątki; reszta to `Button`/`IconButton`. Progi maleją działami.
// Grafik (2026-11-20): radia i przełączniki (paleta pędzli, wybór w oknie dnia, dni urlopu, kolory), komórki siatki,
// krokomierz czasu (`TimeStepper`, przytrzymanie), linki w zdaniu, wiersze rozwijane i karty-listy (`cardVariant`).
// Dziś i Kalendarz (2026-11-20): wiersze-listy (termin, rata, ćwiczenia, dzień w agendzie, chip na osi), pola wyboru listy,
// linki w zdaniu, nagłówek rozwijany osi dnia, komórki tygodnia i siatki, warstwy kalendarza (`aria-pressed`), wybór notatki.
// Długi, Ćwiczenia, Klienci, Skarbiec (2026-11-20): pigułki wyboru (`aria-pressed`, radio), podpowiedzi-pigułki, linki w zdaniu,
// kafle i wiersze-listy, rozwijane nagłówki, miniatura dowodu, „Nowa wycena” obok linków-pigułek, akcje kafla notatki (`card-action`).
// Ustawienia i pasek boczny (2026-11-20): wybór stylu, akcentu, kroju, ramek, sezonu, układu, gęstości, kolumn, koloru, dnia przeglądu
// (radio i `aria-pressed`), skróty sekcji, „Wyczyść” w zdaniu, zestawy wyglądu (wiersze), wiersz paska, rozwijanie folderu, emoji i kolory.
// Plany (2026-11-20): przełączniki trybu i podsumowania (`aria-pressed`), wiersze wyboru (materiały, symbole, trasy), typ symbolu (radio),
// miniatura analizy, „Inny plik” w zdaniu, uchwyt wysokości panelu.
// Praca (2026-11-20): przyciski-ikony i pigułki (warianty `chip`, `chip-soft`, `chip-add`, `pill`) przeniesione. Zostały przerywane wiersze „dodaj”,
// pigułki z `cn(...)` i stanem, wiersze-listy i kafle, linki w zdaniu, dyktowanie, przyciski na zdjęciu (biel na ciemnym), FAB.
// Główny katalog `components/` (2026-11-20): przeniesione „Znajdź i zamień”, ikona paska bocznego, zapis aliasu. Zostało 138 — długi ogon:
// pasek edytora notatki i kafla (`card-action`), listy kontrolne, wybór koloru i rysunek, nawigacja dolna, pigułki, linki w zdaniu.
const RAW_BUTTON_MAX: Record<string, number> = { shifts: 26, review: 11, calendar: 14, debts: 3, cwiczenia: 8, clients: 8, vault: 5, sync: 1, settings: 22, sidebar: 6, plans: 10, study: 106, ".": 127 };
describe("W4.5 — surowe <button> w działach", () => {
  for (const [dir, max] of Object.entries(RAW_BUTTON_MAX)) {
    it(`components/${dir}: co najwyżej ${max} (zamiast tego: Button / IconButton)`, () => {
      // `.` = pliki leżące wprost w `components/` (bez podkatalogów).
      const inDir = (p: string) => (dir === "." ? /\/components\/[^/]+$/.test(p) : p.includes(`/components/${dir}/`));
      const n = SOURCES.filter(({ path }) => inDir(path.replace(/\\/g, "/")))
        .reduce((sum, { text }) => sum + (text.match(/<button\b/g)?.length ?? 0), 0);
      expect(n).toBeLessThanOrEqual(max);
    });
  }
});

// W1.7: kolory w CSS tylko w OKLCH (przeliczone narzędziem 2026-11-19). Komentarze i `url(…)` (SVG w data URL) się nie liczą.
function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return cssFiles(path);
    return name.endsWith(".css") ? [path] : [];
  });
}
describe("W1.7 — kolory w CSS w OKLCH", () => {
  it("bez hsl() i #hex poza komentarzami i url()", () => {
    const hits = cssFiles(SRC).flatMap((path) => {
      const text = readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/url\([^)]*\)/g, "");
      return (text.match(/hsla?\(|#[0-9a-fA-F]{3,8}\b/g) ?? []).map((m) => `${path}: ${m}`);
    });
    expect(hits).toEqual([]);
  });
});

// W6.4: `!important` tylko tam, gdzie kolejność warstw nie wystarczy — ograniczony ruch (globalnie i w utility
// z animacją), druk raportu, pauza w karcie w tle, tryb OLED (zdejmuje rozmycie z utility), toasty Sonnera
// (jego styl wstrzykiwany po naszym) i płynna zmiana motywu (przebija `transition-*` komponentów). Opis: opis.md, W6.4.
const IMPORTANT_MAX = 31;
describe("W6.4 — !important w CSS", () => {
  it(`co najwyżej ${IMPORTANT_MAX} poza komentarzami`, () => {
    const n = cssFiles(SRC).reduce((sum, path) => sum + (readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").match(/!important/g)?.length ?? 0), 0);
    expect(n).toBeLessThanOrEqual(IMPORTANT_MAX);
  });
});

describe("tokeny projektowe — surowe klasy nie przybywają", () => {
  for (const [name, { pattern, max, token }] of Object.entries(LIMITS)) {
    it(`${name}: co najwyżej ${max} wystąpień (zamiast tego: ${token})`, () => {
      expect(count(pattern)).toBeLessThanOrEqual(max);
    });
  }
});
