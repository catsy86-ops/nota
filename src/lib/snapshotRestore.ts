import type { Folder, Note } from "@/lib/types/note";
import type { DocState, YjsStore } from "@/lib/yjsStore";
import type { PrivateContent } from "@/lib/privateNotes";
import { MIGRATION_LOCK, withExclusiveLock } from "@/lib/tabLock";

/**
 * Przywracanie z kopii dziennej — ścieżka domyślna (Z-16.1B, `docs/plan-dane-lokalne.md` §1.5): wybrane notatki
 * z kopii wracają jako **nowe** notatki z nowymi identyfikatorami w folderze „Przywrócone DD.MM”. Oryginały, jeśli
 * istnieją, są nietknięte, więc ta ścieżka jest bezpieczna także przy synchronizacji: kopie to zwykłe nowe notatki.
 * Obejmuje tylko notatki (działy — ścieżką awaryjną albo z kopii do pliku).
 */

/** „locked” — skarbiec zablokowany (wystarczy odblokować); „other-key” — kopia z innym kluczem (zmiana hasła). */
export type PrivateState = "plain" | "ok" | "locked" | "other-key";

export interface SnapshotItem {
  /** Notatka z kopii. */
  note: Note;
  /** Ta sama notatka teraz (dla „zmienionych”). */
  current?: Note;
  /** Notatka prywatna: „ok” — da się przywrócić (ten sam klucz, skarbiec odblokowany); inaczej powód. */
  privacy: PrivateState;
}

export interface SnapshotComparison {
  deleted: SnapshotItem[];
  changed: SnapshotItem[];
  unchanged: SnapshotItem[];
}

const sameMeta = (a: unknown, b: unknown) => a !== undefined && a !== null && JSON.stringify(a) === JSON.stringify(b);

/**
 * Trzy grupy: usunięte od tamtej pory (identyfikatora nie ma w dokumencie), zmienione (inny tytuł albo treść; dla
 * notatki prywatnej — inny szyfrogram), bez zmian. Notatka prywatna da się przywrócić tylko wtedy, gdy metadane
 * skarbca w kopii są takie same jak bieżące i skarbiec jest odblokowany (szyfrogram przechodzi pod nowy id).
 */
export function compareSnapshot(snapshot: DocState, current: Note[], currentVaultMeta: unknown, vaultUnlocked: boolean): SnapshotComparison {
  const now = new Map(current.map((n) => [n.id, n]));
  const sameKey = sameMeta(snapshot.vaultMeta, currentVaultMeta);
  const out: SnapshotComparison = { deleted: [], changed: [], unchanged: [] };
  for (const note of snapshot.notes) {
    const privacy: PrivateState = !note.locked ? "plain" : !sameKey ? "other-key" : vaultUnlocked ? "ok" : "locked";
    const cur = now.get(note.id);
    if (!cur) { out.deleted.push({ note, privacy }); continue; }
    const differs = note.locked || cur.locked
      ? note.vault !== cur.vault || note.locked !== cur.locked
      : note.title !== cur.title || note.content !== cur.content;
    (differs ? out.changed : out.unchanged).push({ note, current: cur, privacy });
  }
  const byTime = (a: SnapshotItem, b: SnapshotItem) => b.note.updatedAt - a.note.updatedAt;
  out.deleted.sort(byTime);
  out.changed.sort(byTime);
  return out;
}

/** Nazwa folderu z kopiami: „Przywrócone 12.11”. */
export function restoredFolderName(createdAt: number): string {
  const d = new Date(createdAt);
  return `Przywrócone ${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Zależności — w testach atrapy. */
export interface RestoreDeps {
  store: Pick<YjsStore, "insertNoteCopies" | "projectFolders">;
  reencryptCopy: (oldId: string, token: string, newId: string, folderId: string) => Promise<{ token: string; content: PrivateContent } | null>;
  adoptCopy: (id: string, token: string, content: PrivateContent) => void;
  newId?: () => string;
  now?: () => number;
  lock?: <T>(fn: () => Promise<T>) => Promise<T>;
}

export interface RestoreResult {
  restored: number;
  /** Notatki prywatne, których nie dało się przenieść (inny klucz, zablokowany skarbiec). */
  skipped: string[];
  folderId: string;
}

/**
 * Kopie wybranych notatek w jednej transakcji, pod `MIGRATION_LOCK` (jak import kopii). Kopia dostaje nowy id,
 * nie jest przypięta, w koszu ani w archiwum, bez przypomnienia (oryginał może jeszcze istnieć — dwa alarmy) i bez
 * rodzica (rodzica może już nie być); notatka dzienna przestaje nią być (jedna notatka na dzień). Treść, kolor,
 * etykiety, pola i odwołania do obrazów zostają — obraz jest, jeśli magazyn obrazów go ma.
 */
export async function restoreSnapshotCopies(items: SnapshotItem[], snapshot: Pick<DocState, "propDefs">, snapshotCreatedAt: number, deps: RestoreDeps): Promise<RestoreResult> {
  const newId = deps.newId ?? (() => crypto.randomUUID());
  const now = deps.now ?? Date.now;
  const lock = deps.lock ?? (<T,>(fn: () => Promise<T>) => withExclusiveLock(MIGRATION_LOCK, fn));
  return lock(async () => {
    const t = now();
    const name = restoredFolderName(snapshotCreatedAt);
    // Istniejący folder o tej nazwie (drugie przywracanie z tego dnia) — id znany przed szyfrowaniem notatek prywatnych.
    const existing = deps.store.projectFolders().find((f) => f.name === name && !f.parentId);
    const folder: Folder = existing ?? { id: newId(), name, color: "default", emoji: null, parentId: null, order: 0, createdAt: t, updatedAt: t };
    const copies: Note[] = [];
    const adopted: { id: string; token: string; content: PrivateContent }[] = [];
    const skipped: string[] = [];
    for (const { note, privacy } of items) {
      if (privacy !== "plain" && privacy !== "ok") { skipped.push(note.id); continue; }
      const id = newId();
      const { dailyDate: _daily, periodKey: _period, parentId: _parent, ...rest } = note;
      const copy: Note = { ...rest, id, pinned: false, archived: false, trashed: false, trashedAt: null, reminder: null, order: 0, updatedAt: t };
      if (note.locked && note.vault) {
        // Folder w szyfrogramie ten sam, w którym kopia ląduje (liczy się przy zdjęciu blokady).
        const enc = await deps.reencryptCopy(note.id, note.vault, id, folder.id);
        if (!enc) { skipped.push(note.id); continue; }
        copy.vault = enc.token;
        adopted.push({ id, token: enc.token, content: enc.content });
      }
      copies.push(copy);
    }
    const folderId = copies.length ? deps.store.insertNoteCopies(copies, folder, snapshot.propDefs) : folder.id;
    for (const a of adopted) deps.adoptCopy(a.id, a.token, a.content);
    return { restored: copies.length, skipped, folderId };
  });
}
