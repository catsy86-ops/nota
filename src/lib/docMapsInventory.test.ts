import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SHIFTS_MAP_BASE_NAMES } from "@/lib/shifts/yShifts";

/**
 * D1.2 (`docs/plan-migracje-yjs-2026-11-15.md`): spis map Yjs i zapadka zgodności w przód. Każda mapa wymieniona
 * w kodzie (`getMap("…")` albo stała z nazwą) musi mieć kategorię:
 * - `PRESERVES` — wpis to zwykły obiekt, a `clean*` zachowuje nieznane pola (`extraFields.ts`); test „nieznane pole
 *   przeżywa edycję” jest przy module (plik w komentarzu);
 * - `EXEMPT` — mapa pól (`Y.Map` na wpis, pole nowszej wersji to osobny klucz i przeżywa samo), bufor transportu
 *   albo mapa sterująca bez edycji wpisów;
 * - `TODO` — jeszcze nie sprawdzona albo gubi nieznane pola (D1.1 działami). Ta lista może tylko maleć.
 * Nowa mapa bez kategorii wywala test.
 */
const PRESERVES: Record<string, string> = {
  debts: "src/lib/debts/yDebts.extra.test.ts",
  debtPlans: "src/lib/debts/plans.test.ts",
  studyInvoices: "src/lib/study/extra.test.ts",
  studyBilling: "src/lib/study/extra.test.ts",
  studyJobs: "src/lib/study/extra.test.ts",
  supplements: "src/lib/supplements/extra.test.ts",
  trainingLog: "src/lib/training/extra.test.ts",
  trainingPlans: "src/lib/exerciseExtra.test.ts",
  trainingExercises: "src/lib/exerciseExtra.test.ts",
  weightEntries: "src/lib/exerciseExtra.test.ts",
  dietMeals: "src/lib/exerciseExtra.test.ts",
  dietMeta: "src/lib/exerciseExtra.test.ts",
  studyCustom: "src/lib/study/extraD11.test.ts",
  studyKits: "src/lib/study/extraD11.test.ts",
  studyMeta: "src/lib/study/extraD11.test.ts",
  studyPoints: "src/lib/study/extraD11.test.ts",
  studyPricing: "src/lib/study/extraD11.test.ts",
  studyReview: "src/lib/study/extraD11.test.ts",
  studyRounds: "src/lib/study/extraD11.test.ts",
  studyVan: "src/lib/study/extraD11.test.ts",
  shiftDays: "src/lib/extraD11rest.test.ts",
  shiftTypes: "src/lib/extraD11rest.test.ts",
  shiftPatterns: "src/lib/extraD11rest.test.ts",
  shiftBonuses: "src/lib/extraD11rest.test.ts",
  shiftSchedules: "src/lib/extraD11rest.test.ts",
  trainingMeta: "src/lib/extraD11rest.test.ts",
  folders: "src/lib/extraD11rest.test.ts",
  propDefs: "src/lib/extraD11rest.test.ts",
  views: "src/lib/extraD11rest.test.ts",
};

const EXEMPT: Record<string, string> = {
  notes: "Y.Map na notatkę — pole to osobny klucz",
  syncControl: "znaczniki wymiany kodu, zapis tylko przez rekey.ts",
  blobs: "bufor transportu obrazów w osobnym dokumencie w pamięci",
  docFormat: "wymagania wersji (D1.3), wartości to liczby",
  studyMigrations: "znaczniki migracji na urządzenie",
  shiftMigrations: "znaczniki migracji Grafiku na urządzenie",
  clients: "pole na klucz (`f␁id␁pole`) — pole nowszej wersji to osobny klucz",
  supplementLog: "wartości `true` (odhaczenie dnia)",
  studyJournal: "Y.Map na wpis; `writeEntry` zmienia tylko pola znane tej wersji",
  studySites: "Y.Map na kartę; `writeCard` kasuje tylko pola z `SITE_CARD_KEYS`",
  studyEntryCheck: "`setRecord` scala pola obce (`foreign`) z nowymi",
  studyBoard: "wartości to nazwy kolumn",
  studyChecked: "wartości `true`",
  studyMissed: "wartości `true`",
  studyDays: "wartości `true`",
  studyExams: "wynik zapisywany raz, bez edycji",
  shiftMeta: "wartości proste pod osobnymi kluczami (stawki, ustawienia)",
  labels: "wartości `true`",
  debtProofs: "`{ ref, at }` zastępowane w całości przy zmianie zdjęcia; nic do edycji",
};

/** Do sprawdzenia w D1.1 (działami). Zmniejszaj, przenosząc do PRESERVES albo EXEMPT z uzasadnieniem. */
const TODO = [
  "plans", "studySiteItems", "vault",
];
const TODO_MAX = 3;

const CONSTS: Record<string, string> = { SYNC_CONTROL_MAP: "syncControl", PLANS_MAP: "plans", REGISTRY_MAP: "shiftSchedules", DOC_FORMAT_MAP: "docFormat", DEBT_PROOFS_MAP: "debtProofs" };

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
  });
}

describe("D1.2: spis map Yjs", () => {
  const found = new Set<string>();
  for (const p of sources(resolve(__dirname, ".."))) {
    for (const m of readFileSync(p, "utf8").matchAll(/getMap(?:<[^(]*>)?\(\s*(?:"([A-Za-z0-9_-]+)"|([A-Z_]+))\s*\)/g)) {
      const name = m[1] ?? CONSTS[m[2]];
      if (m[2] && !name) throw new Error(`nieznana stała nazwy mapy: ${m[2]} w ${p}`);
      found.add(name!);
    }
  }
  // Grafik: nazwy składane na grafik (`shiftsMapName`), więc z listy bazowej, nie z tekstu źródeł.
  for (const n of SHIFTS_MAP_BASE_NAMES) found.add(n);

  it("każda mapa ma kategorię; nowa mapa wymaga decyzji o nieznanych polach", () => {
    const known = new Set([...Object.keys(PRESERVES), ...Object.keys(EXEMPT), ...TODO]);
    expect([...found].filter((n) => !known.has(n)).sort()).toEqual([]);
  });

  it("lista do zrobienia tylko maleje i nie trzyma map, których już nie ma", () => {
    expect(TODO.length).toBeLessThanOrEqual(TODO_MAX);
    expect(TODO.filter((n) => !found.has(n))).toEqual([]);
  });

  it("mapy zachowujące nieznane pola mają swój test", () => {
    for (const file of new Set(Object.values(PRESERVES))) expect(statSync(resolve(__dirname, "../..", file)).isFile()).toBe(true);
  });
});
