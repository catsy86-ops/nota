import type * as Y from "yjs";

/**
 * Rejestr migracji (D2.1, `docs/plan-migracje-yjs-2026-11-15.md`). Kolejność wykonania = kolejność na liście, nie daty.
 * `id` jest trwałe (`2026-11-nazwa`) — trafia jako znacznik do mapy `docMigrations` i nigdy się nie zmienia.
 *
 * Zasady dla migracji zakresu „dokument” (wykonawca: `runner.ts`):
 * - działa na kopii roboczej, a do żywego dokumentu trafia sama różnica — zmiany innych urządzeń, które przyjdą
 *   w międzyczasie, scalą się z nią jak każde inne, więc migracja musi być idempotentna i nie może zmieniać
 *   znaczenia istniejącego pola (pole o nowym znaczeniu dostaje nową nazwę — D2.6);
 * - `run` nie może rzucać po częściowym zapisie w nadziei na cofnięcie — kopia robocza jest wyrzucana, ale tylko
 *   ona; `check` zwraca opis błędu albo `null`.
 *
 * Przed pierwszą migracją „dokument” trzeba spisać obserwatory, które biorą zmianę za edycję użytkownika
 * (`updatedAt`, historia wersji, status zapisu) — muszą pomijać `origin` zaczynający się od `migration:`
 * (`isMigrationOrigin`).
 */

export interface DocMigration {
  id: string;
  scope: "dokument";
  /** Co zmienia — do dziennika diagnostycznego. */
  description: string;
  /** Numer formatu (`SCHEMA_VERSION`), od którego aplikacja ma tę migrację. */
  since: number;
  run(doc: Y.Doc): void;
  check(doc: Y.Doc): string | null;
}

/**
 * Migracje wykonywane na każdym urządzeniu osobno, ze znacznikami tam, gdzie były przed rejestrem (D2.3).
 * Przenoszenie znaczników byłoby kolejną migracją, więc rejestr tylko je opisuje; logika zostaje w miejscu.
 */
export interface LocalMigration {
  id: string;
  scope: "lokalne" | "lokalne → dokument";
  description: string;
  /** Gdzie jest znacznik i kod. */
  where: string;
}

export const DOC_MIGRATIONS_MAP = "docMigrations";
export const MIGRATION_ORIGIN_PREFIX = "migration:";

export const isMigrationOrigin = (origin: unknown): boolean =>
  typeof origin === "string" && origin.startsWith(MIGRATION_ORIGIN_PREFIX);

/** Migracje dokumentu. Dziś pusta — pierwsza dojdzie z pierwszą zmianą kształtu danych po D2. */
export const DOC_MIGRATIONS: readonly DocMigration[] = [];

export const LOCAL_MIGRATIONS: readonly LocalMigration[] = [
  { id: "2026-10-yjs-legacy", scope: "lokalne", description: "notatki z dawnego magazynu IndexedDB do Yjs, obrazy do magazynu obrazów", where: "`kaczy.yjs.migrated.v1.<baza>` — `migrateFromLegacyIfNeeded`, `migrateImagesToStore` w `yjsStore.ts`" },
  { id: "2026-10-study-local", scope: "lokalne → dokument", description: "postęp Pracy z localStorage do map `study*`, listy z karty budowy do `studySiteItems`", where: "mapa `studyMigrations` (klucz na urządzenie) — `yStudy.ts`, `migrateCardLists`" },
  { id: "2026-10-shifts-local", scope: "lokalne → dokument", description: "Grafik z localStorage do map `shift*` każdego grafiku", where: "mapa `shiftMigrations` danego grafiku (klucz na urządzenie) — `yShifts.ts`" },
];

/** Identyfikator: rok-miesiąc i nazwa z małych liter, cyfr i myślników. */
export const MIGRATION_ID_RE = /^\d{4}-\d{2}-[a-z0-9-]{1,48}$/;
