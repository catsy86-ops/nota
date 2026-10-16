/**
 * Lista robocza: odłożone szkice nowych notatek (kompozytor). Każdy szkic ma id i moment odłożenia;
 * najnowszy jest pierwszy. Logika czysta — zapis do localStorage robi komponent.
 */

export const PARKED_MAX = 20;
export const PARKED_LABEL_MAX = 40;

export interface Parked<T> {
  id: string;
  /** Moment odłożenia (ms). */
  at: number;
  draft: T;
}

/** Krótka etykieta szkicu: tytuł, potem pierwsza linia treści, potem pierwsza pozycja listy. */
export function parkedLabel(d: { title: string; content: string; checklist: readonly { text: string }[] }): string {
  const firstLine = (s: string) => s.split("\n").map((l) => l.trim()).find((l) => l.length > 0) ?? "";
  const raw = d.title.trim() || firstLine(d.content) || firstLine(d.checklist.map((c) => c.text).join("\n")) || "Bez tytułu";
  return raw.length > PARKED_LABEL_MAX ? raw.slice(0, PARKED_LABEL_MAX - 1).trimEnd() + "…" : raw;
}

/** Dokłada szkic na początek listy; ponad limit odpada najstarszy. */
export function addParked<T>(list: readonly Parked<T>[], draft: T, id: string, now: number): Parked<T>[] {
  return [{ id, at: now, draft }, ...list].slice(0, PARKED_MAX);
}

export function removeParked<T>(list: readonly Parked<T>[], id: string): Parked<T>[] {
  return list.filter((p) => p.id !== id);
}
