import { APP_VERSION } from "@/content/changelog";
import { saveBeforeReplace } from "@/lib/dailySnapshot";
import { logDiag } from "@/lib/diagnostics";
import { createPersistedStore } from "@/lib/persistedStore";
import { MIGRATION_LOCK, withExclusiveLock } from "@/lib/tabLock";
import { yjsStore } from "@/lib/yjsStore";
import { DOC_MIGRATIONS } from "./registry";
import { runDocMigrations } from "./runner";
import { DANE } from "@/lib/storage/names";

/** Porażki na migrację (lokalnie — to wiedza tego urządzenia, nie dane). */
const failStore = createPersistedStore<Record<string, number>>(DANE.migrationsFailures, {}, {
  merge: (_d, s) => (s && typeof s === "object" && !Array.isArray(s)
    ? Object.fromEntries(Object.entries(s as Record<string, unknown>).filter((e): e is [string, number] => typeof e[1] === "number"))
    : {}),
});

/** Migracje, które trzy razy się nie udały — baner z prośbą o kopię i zgłoszenie. */
export const giveUpStore = createPersistedStore<string[]>(DANE.migrationsGiveup, [], {
  merge: (_d, s) => (Array.isArray(s) ? s.filter((x): x is string => typeof x === "string").slice(0, 20) : []),
});
export const useMigrationGiveUps = () => giveUpStore.use();

/** Po `ready()`: migracje dokumentu z rejestru (D2.2). Pusty rejestr nic nie robi — bez blokady i bez migawki. */
export async function startDocMigrations(): Promise<void> {
  if (DOC_MIGRATIONS.length === 0) return;
  await runDocMigrations(yjsStore.doc as never, DOC_MIGRATIONS, {
    lock: (fn) => withExclusiveLock(MIGRATION_LOCK, fn),
    // D2.4: kopia w katalogu „przed przywróceniem” (30 dni) — przywracana z Ustawień → Kopia i dane.
    snapshot: async () => {
      await saveBeforeReplace({
        encode: () => yjsStore.encodeSyncState(),
        stateVector: () => yjsStore.encodeStateVector(),
        notes: () => yjsStore.notesMap.size,
      });
    },
    failures: {
      get: (id) => failStore.get()[id] ?? 0,
      set: (id, n) => failStore.set({ ...failStore.get(), [id]: n }),
    },
    log: (level, message, err) => logDiag(level, "migrations", message, err),
    onGiveUp: (id) => { if (!giveUpStore.get().includes(id)) giveUpStore.set([...giveUpStore.get(), id]); },
    version: APP_VERSION,
  });
}
