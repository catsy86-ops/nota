import * as Y from "yjs";
import { DOC_MIGRATIONS_MAP, MIGRATION_ORIGIN_PREFIX, type DocMigration } from "./registry";

/**
 * Wykonawca migracji dokumentu (D2.2). Yjs nie cofa transakcji, więc migracja nie działa na żywym dokumencie:
 * (1) migawka (D2.4), (2) kopia robocza — nowy `Y.Doc` z własnym, losowym `clientID` + stan żywego dokumentu,
 * (3) na kopii jedna transakcja: dane i znacznik w `docMigrations`, (4) `check` na kopii, (5) różnica do żywego
 * dokumentu jednym `applyUpdate` z `origin` `migration:<id>`. Błąd na kopii → nic nie zapisane; ponowienie przy
 * następnym starcie, po 3 porażkach `onGiveUp` (baner z prośbą o kopię i zgłoszenie).
 */

export interface RunnerDeps {
  /** Blokada jednej karty (`MIGRATION_LOCK`) — druga karta czeka i zastaje znaczniki. */
  lock<T>(fn: () => Promise<T>): Promise<T>;
  /** Migawka przed pierwszą migracją; błąd przerywa całość bez zapisu. */
  snapshot(): Promise<void>;
  failures: { get(id: string): number; set(id: string, n: number): void };
  log(level: "info" | "warn" | "error", message: string, err?: unknown): void;
  onGiveUp?(id: string): void;
  now?(): number;
  /** Wersja aplikacji zapisywana przy znaczniku. */
  version: string;
}

export const MAX_FAILURES = 3;

export interface RunResult {
  done: string[];
  failed: string[];
  skipped: string[];
}

const markers = (doc: Y.Doc) => doc.getMap<unknown>(DOC_MIGRATIONS_MAP);

export function pendingMigrations(doc: Y.Doc, list: readonly DocMigration[]): DocMigration[] {
  const m = markers(doc);
  return list.filter((x) => !m.has(x.id));
}

/** Jedna migracja na kopii roboczej; zwraca różnicę do nałożenia albo rzuca. */
export function migrateOnCopy(live: Y.Doc, migration: DocMigration, at: number, version: string): Uint8Array {
  const sv = Y.encodeStateVector(live);
  // Nowy dokument losuje własny clientID — nigdy nie kopiować go z żywego (te same id + różna treść psują scalanie).
  const work = new Y.Doc();
  Y.applyUpdate(work, Y.encodeStateAsUpdate(live));
  work.transact(() => {
    migration.run(work);
    markers(work).set(migration.id, { at, version });
  }, MIGRATION_ORIGIN_PREFIX + migration.id);
  const problem = migration.check(work);
  if (problem) throw new Error(`sprawdzenie nie przeszło: ${problem}`);
  const diff = Y.encodeStateAsUpdate(work, sv);
  work.destroy();
  return diff;
}

export async function runDocMigrations(live: Y.Doc, list: readonly DocMigration[], deps: RunnerDeps): Promise<RunResult> {
  const result: RunResult = { done: [], failed: [], skipped: [] };
  if (pendingMigrations(live, list).length === 0) return result;
  return deps.lock(async () => {
    // Znaczniki od nowa pod blokadą — inna karta mogła już zrobić swoje.
    const pending = pendingMigrations(live, list);
    const todo = pending.filter((m) => deps.failures.get(m.id) < MAX_FAILURES);
    result.skipped = pending.filter((m) => !todo.includes(m)).map((m) => m.id);
    if (todo.length === 0) return result;
    try {
      await deps.snapshot();
    } catch (err) {
      deps.log("error", "migawka przed migracją nie powstała — migracje odłożone", err);
      result.skipped.push(...todo.map((m) => m.id));
      return result;
    }
    for (const m of todo) {
      // Mogła przyjść z innego urządzenia w trakcie poprzedniej.
      if (markers(live).has(m.id)) continue;
      try {
        const diff = migrateOnCopy(live, m, deps.now?.() ?? Date.now(), deps.version);
        Y.applyUpdate(live, diff, MIGRATION_ORIGIN_PREFIX + m.id);
        deps.failures.set(m.id, 0);
        result.done.push(m.id);
        const after = m.check(live);
        if (after) deps.log("warn", `${m.id}: po scaleniu z żywym dokumentem ${after}`);
        else deps.log("info", `${m.id}: ${m.description}`);
      } catch (err) {
        const n = deps.failures.get(m.id) + 1;
        deps.failures.set(m.id, n);
        result.failed.push(m.id);
        deps.log("error", `${m.id}: migracja nieudana (${n}/${MAX_FAILURES}), dane bez zmian`, err);
        if (n >= MAX_FAILURES) deps.onGiveUp?.(m.id);
        // Kolejne mogą zależeć od tej — reszta przy następnym starcie.
        break;
      }
    }
    return result;
  });
}
