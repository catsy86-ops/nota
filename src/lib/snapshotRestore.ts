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
  /** Jawna w kopii, prywatna teraz (M3): bez odblokowania tytuł i treść ukryte, przywracana jako zaszyfrowana. */
  sealed?: boolean;
}

export interface SnapshotComparison {
  deleted: SnapshotItem[];
  changed: SnapshotItem[];
  unchanged: SnapshotItem[];
}

const sameMeta = (a: unknown, b: unknown) => a !== undefined && a !== null && JSON.stringify(a) === JSON.stringify(b);

/** Skarbiec w kopii inny niż obecny (zmiana hasła, założenie albo usunięcie skarbca po dniu kopii) — ostrzeżenie przy wymianie całego dokumentu. */
export function vaultDiffers(snapshotVaultMeta: unknown, currentVaultMeta: unknown): boolean {
  if (snapshotVaultMeta == null && currentVaultMeta == null) return false;
  return !sameMeta(snapshotVaultMeta, currentVaultMeta);
}

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
    if (!note.locked && cur.locked) {
      // Zaszyfrowana bieżącym kluczem przy przywracaniu — metadane skarbca kopii nie mają znaczenia.
      out.changed.push({ note, current: cur, privacy: vaultUnlocked ? "ok" : "locked", sealed: true });
      continue;
    }
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
  /** Szyfrowanie kopii notatki jawnej w kopii dziennej, a prywatnej teraz (`SnapshotItem.sealed`). */
  sealCopy?: (note: Note) => Promise<{ token: string; content: PrivateContent } | null>;
  /** Znacznik sesji klucza skarbca; zwrócona funkcja mówi, czy klucz nadal ten sam. */
  copySession?: () => () => boolean;
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
 * nie jest przypięta, w koszu ani w archiwum, bez przypomnienia i jego reguł, aliasów i gwiazdki „ulubiona” (oryginał może jeszcze istnieć — dwa alarmy) i bez
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
    const sameKey = deps.copySession?.() ?? (() => true);
    const copies: Note[] = [];
    const adopted: { id: string; token: string; content: PrivateContent }[] = [];
    const skipped: string[] = [];
    const origin = new Map<string, string>();
    for (const { note, privacy, sealed } of items) {
      if (privacy !== "plain" && privacy !== "ok") { skipped.push(note.id); continue; }
      const id = newId();
      // Aliasy zdublowałyby rozwiązywanie [[linków]] z oryginałem; ulubiona i reguły przypomnienia należą do oryginału.
      const {
        dailyDate: _daily, periodKey: _period, parentId: _parent, aliases: _aliases, favorite: _fav,
        reminderRepeat: _rr, reminderRule: _rule, reminderRepeatUntil: _until, reminderBase: _base, snoozedUntil: _snooze, ...rest
      } = note;
      const copy: Note = { ...rest, id, pinned: false, archived: false, trashed: false, trashedAt: null, reminder: null, order: 0, updatedAt: t };
      if (sealed) {
        const enc = await deps.sealCopy?.({ ...copy, folderId: folder.id });
        if (!enc) { skipped.push(note.id); continue; }
        Object.assign(copy, { title: "", content: "", labels: [], checklist: [], locked: true, vault: enc.token });
        adopted.push({ id, token: enc.token, content: enc.content });
        origin.set(id, note.id);
      } else if (note.locked && note.vault) {
        // Folder w szyfrogramie ten sam, w którym kopia ląduje (liczy się przy zdjęciu blokady).
        const enc = await deps.reencryptCopy(note.id, note.vault, id, folder.id);
        if (!enc) { skipped.push(note.id); continue; }
        copy.vault = enc.token;
        adopted.push({ id, token: enc.token, content: enc.content });
        origin.set(id, note.id);
      }
      copies.push(copy);
    }
    // Blokada albo zmiana hasła w trakcie szyfrowania — kopie prywatne odpadają (jak przy zablokowanym skarbcu).
    if (adopted.length && !sameKey()) {
      const lost = new Set(adopted.map((a) => a.id));
      for (const c of copies) if (lost.has(c.id)) skipped.push(origin.get(c.id)!);
      copies.splice(0, copies.length, ...copies.filter((c) => !lost.has(c.id)));
      adopted.length = 0;
    }
    const folderId = copies.length ? deps.store.insertNoteCopies(copies, folder, snapshot.propDefs) : folder.id;
    for (const a of adopted) deps.adoptCopy(a.id, a.token, a.content);
    return { restored: copies.length, skipped, folderId };
  });
}
