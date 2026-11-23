import { logDiag } from "@/lib/diagnostics";
import { MIGRATION_LOCK, withExclusiveLock } from "@/lib/tabLock";

/**
 * D6.3 (`docs/plan-migracje-yjs-2026-11-15.md`): przejście klucza `localStorage` na nową nazwę (np. `.v1` → `.v2`).
 * Czyta stary, zapisuje nowy (tylko gdy nowego jeszcze nie ma), stary zostaje — usuwa go `dropOldKey` dopiero
 * w następnym wydaniu, żeby powrót do starszej wersji aplikacji nie zastał pustego klucza. `transform` zwraca
 * nową wartość albo `null`, gdy stary zapis jest nie do użycia (wtedy nowego nie zapisujemy, stary zostaje).
 * Dwie karty naraz: pod blokadą migracji (Q1.1), więc przekształcenie wykona się raz.
 */
export type MigrateKeyResult = "migrated" | "already" | "no-source" | "rejected" | "error";

export function migrateKeySync(oldKey: string, newKey: string, transform: (raw: string) => string | null, storage: Storage = localStorage): MigrateKeyResult {
  try {
    if (storage.getItem(newKey) !== null) return "already";
    const raw = storage.getItem(oldKey);
    if (raw === null) return "no-source";
    let next: string | null;
    try { next = transform(raw); } catch { next = null; }
    if (next === null) {
      logDiag("warn", "storage", `nie przeniesiono ${oldKey} → ${newKey}: zły kształt, stary klucz zostaje`);
      return "rejected";
    }
    storage.setItem(newKey, next);
    return "migrated";
  } catch (err) {
    logDiag("error", "storage", `migracja klucza ${oldKey} → ${newKey} nie powiodła się`, err);
    return "error";
  }
}

export function migrateKey(oldKey: string, newKey: string, transform: (raw: string) => string | null, storage: Storage = localStorage): Promise<MigrateKeyResult> {
  return withExclusiveLock(MIGRATION_LOCK, async () => migrateKeySync(oldKey, newKey, transform, storage));
}

/** Usunięcie starego klucza — wydanie po `migrateKey`, i tylko gdy nowy istnieje. */
export function dropOldKey(oldKey: string, newKey: string, storage: Storage = localStorage): boolean {
  try {
    if (storage.getItem(newKey) === null || storage.getItem(oldKey) === null) return false;
    storage.removeItem(oldKey);
    return true;
  } catch {
    return false;
  }
}
