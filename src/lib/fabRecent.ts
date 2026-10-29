/**
 * Ostatnio wybrany rodzaj w arkuszu „Nowa” (plan FAB, F1.3). Kafel tego rodzaju wraca na górę
 * i dostaje odznakę. Per urządzenie (`localStorage`); błąd dostępu = brak zapamiętanego rodzaju.
 */
export type QuickKind = "note" | "reminder" | "list" | "image" | "draw" | "dictate";

const KEY = "kaczy.fab.last.v1";
const KINDS: readonly QuickKind[] = ["note", "reminder", "list", "image", "draw", "dictate"];

export function readLastQuick(): QuickKind | null {
  try {
    const v = localStorage.getItem(KEY);
    return KINDS.includes(v as QuickKind) ? (v as QuickKind) : null;
  } catch {
    return null;
  }
}

export function writeLastQuick(kind: QuickKind): void {
  try {
    localStorage.setItem(KEY, kind);
  } catch {
    /* brak localStorage — kolejność zostaje domyślna */
  }
}

/** Kafel ostatnio użytego rodzaju na początku; reszta bez zmian (stabilna kolejność). */
export function orderByRecent<T extends { kind: QuickKind }>(items: T[], last: QuickKind | null): T[] {
  if (!last) return items;
  const hit = items.find((i) => i.kind === last);
  return hit ? [hit, ...items.filter((i) => i !== hit)] : items;
}
