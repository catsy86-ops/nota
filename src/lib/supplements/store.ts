import { useSyncExternalStore } from "react";
import { yjsStore } from "@/lib/yjsStore";
import { localDayKey } from "@/lib/dayDone";
import { cleanSupplement, SUPPLEMENT_DOSE_MAX, SUPPLEMENT_NAME_MAX, SUPPLEMENT_WHEN, type Supplement, type SupplementWhen } from "./model";
import { createYSupplements } from "./ySupplements";

/**
 * Odżywki żyją w dokumencie Yjs notatek (`ySupplements.ts`). Komponenty czytają przez
 * `useSupplements()` i `useSupplementsTaken()`, a zmieniają wyłącznie akcjami poniżej.
 */
const ySupplements = createYSupplements(yjsStore.doc);

export function useSupplements(): Supplement[] {
  return useSyncExternalStore(ySupplements.subscribe, ySupplements.get);
}

/** Zbiór odhaczeń `dzień|id`; zmienia się przy każdym odhaczeniu, na tym samym telefonie i z sieci. */
export function useSupplementsTaken(): Set<string> {
  return useSyncExternalStore(ySupplements.subscribe, ySupplements.getTaken);
}

export interface NewSupplementInput {
  name: string;
  dose?: string;
  when: SupplementWhen;
  /** Godzina codziennego przypomnienia „HH:MM”. */
  remindAt?: string;
  /** Id notatki-przypomnienia utworzonej przez widok (pole zapisuje widok, nie ten moduł). */
  reminderNoteId?: string;
}

/** `null` = niepoprawne dane (pusta nazwa, za długa, obca pora, pełna lista). */
export function addSupplement(input: NewSupplementInput): Supplement | null {
  const name = input.name.trim().slice(0, SUPPLEMENT_NAME_MAX);
  if (!name || !SUPPLEMENT_WHEN.includes(input.when)) return null;
  const entry: Supplement = {
    id: `s-${crypto.randomUUID()}`,
    name,
    dose: (input.dose ?? "").trim().slice(0, SUPPLEMENT_DOSE_MAX),
    when: input.when,
    created: Date.now(),
    ...(input.remindAt ? { remindAt: input.remindAt } : {}),
    ...(input.reminderNoteId ? { reminderNoteId: input.reminderNoteId } : {}),
  };
  // Zapis przechodzi przez to samo czyszczenie co odczyt: zła godzina albo id przepadają tu, a nie przy czytaniu.
  const clean = cleanSupplement(entry);
  if (!clean) return null;
  return ySupplements.add(clean) ? clean : null;
}

export interface SupplementEdit {
  name: string;
  dose: string;
  when: SupplementWhen;
  /** Pusta wartość = bez przypomnienia. */
  remindAt?: string;
  /** Id notatki-przypomnienia po zmianie (puste = brak). */
  reminderNoteId?: string;
}

/** Zmienia dane odżywki zachowując id, datę dodania i odhaczenia. `null` = nie ma jej albo dane są niepoprawne. */
export function updateSupplement(id: string, edit: SupplementEdit): Supplement | null {
  const prev = ySupplements.get().find((s) => s.id === id);
  if (!prev) return null;
  const name = edit.name.trim().slice(0, SUPPLEMENT_NAME_MAX);
  if (!name || !SUPPLEMENT_WHEN.includes(edit.when)) return null;
  const next: Supplement = {
    id: prev.id,
    name,
    dose: edit.dose.trim().slice(0, SUPPLEMENT_DOSE_MAX),
    when: edit.when,
    created: prev.created,
    ...(edit.remindAt ? { remindAt: edit.remindAt } : {}),
    ...(edit.reminderNoteId ? { reminderNoteId: edit.reminderNoteId } : {}),
  };
  return ySupplements.replace(next) ? next : null;
}

export function removeSupplement(id: string): Supplement | null {
  return ySupplements.remove(id);
}

export function restoreSupplement(s: Supplement): void {
  ySupplements.restore(s);
}

/** Odhacza odżywkę w danym dniu (domyślnie dziś). */
export function setSupplementTaken(id: string, on: boolean, day: string = localDayKey()): void {
  ySupplements.setTaken(day, id, on);
}

/** Zrzut odżywek do kopii zapasowej. */
export function supplementDump() {
  return ySupplements.dump();
}

/** Scalenie odżywek z kopii — bez kasowania tego, co już jest na telefonie. */
export function mergeSupplementDump(raw: unknown): void {
  ySupplements.mergeDump(raw);
}
