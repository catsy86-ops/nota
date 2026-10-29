import { useSyncExternalStore } from "react";
import type { JournalDraft } from "./draft";
import type { JournalEntry } from "./yStudy";

/**
 * Czy arkusz „Wpis z budowy” jest otwarty. Poza komponentem, bo otwierają go
 * miejsca spoza dziennika: „+” w dolnym pasku na /nauka, skrót z ekranu
 * głównego (`/nauka?wpis=1`) i „Wpis z budowy” z karty tematu. Bez materiału
 * do nauki — dolny pasek jest w głównej paczce.
 */
export interface JournalSheetState {
  open: boolean;
  /** Otwarty z karty tematu: temat i jego lista kontrolna od razu rozwinięte. */
  topicFirst: boolean;
  /** Edytowany wpis; `null` = nowy wpis ze szkicu. */
  editing: string | null;
}

/**
 * Formularz edycji zapisanego wpisu — osobno od szkicu nowego wpisu, żeby
 * poprawka starego wpisu nie nadpisała tego, co czeka na zapis. Tylko w pamięci:
 * zamknięcie arkusza bez „Zapisz zmiany” porzuca edycję.
 */
export interface JournalEditForm extends Omit<JournalDraft, "at"> {
  id: string;
  at: number;
  site: string;
  resolved: number | null;
}

let state: JournalSheetState = { open: false, topicFirst: false, editing: null };
let editForm: JournalEditForm | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function set(next: JournalSheetState) {
  if (state.open === next.open && state.topicFirst === next.topicFirst && state.editing === next.editing) return;
  state = next;
  emit();
}

export const openJournalSheet = (topicFirst = false) => { editForm = null; set({ open: true, topicFirst, editing: null }); };
export const closeJournalSheet = () => { editForm = null; set({ open: false, topicFirst: false, editing: null }); };

/** Otwiera arkusz z zapisanym wpisem; lista kontrolna rozwinięta, jeśli wpis ma odhaczone punkty. */
export function openJournalEdit(entry: JournalEntry) {
  editForm = {
    id: entry.id, at: entry.at, kind: entry.kind, topic: entry.topic ?? "", text: entry.text,
    checked: [...entry.checked], images: [...entry.images], captions: { ...(entry.captions ?? {}) }, drawnFrom: { ...(entry.drawnFrom ?? {}) }, recordings: [...(entry.recordings ?? [])], site: entry.site, resolved: entry.resolved ?? null,
    test: entry.test ?? null,
    fittings: entry.fittings ?? [],
    pipes: entry.pipes ?? [],
    stage: entry.stage ?? null,
    geo: entry.geo ?? null,
  };
  state = { open: true, topicFirst: entry.checked.length > 0, editing: entry.id };
  emit();
}

export const getJournalEditForm = () => editForm;

/** Zmiana formularza edycji; po zamknięciu arkusza (np. zdjęcie dokończone później) — nic. */
export function patchJournalEditForm(patch: Partial<JournalEditForm>) {
  if (!editForm) return;
  editForm = { ...editForm, ...patch };
  emit();
}

/**
 * Zdjęcia dodane w edycji leżą w `imageStore`, zanim wpis się zapisze — chronione przed odśmiecaniem.
 * Razem z oryginałami narysowanych zdjęć (H0.1), żeby „Cofnij rysunek” miało co przywrócić.
 */
export const journalEditImageRefs = (): string[] => (editForm ? [...editForm.images, ...Object.values(editForm.drawnFrom ?? {})] : []);

const subscribe = (cb: () => void) => { listeners.add(cb); return () => listeners.delete(cb); };

export const useJournalSheet = () => useSyncExternalStore(subscribe, () => state);
export const useJournalEditForm = () => useSyncExternalStore(subscribe, () => editForm);

/** Parametr adresu ze skrótu PWA „Wpis z budowy” (`/nauka?wpis=1`). */
export const JOURNAL_ENTRY_PARAM = "wpis";

/** Parametr razem z `wpis`: `?wpis=1&glos=1` od razu startuje dyktowanie w arkuszu (U5). */
export const JOURNAL_VOICE_PARAM = "glos";

let voiceRequested = false;

/** Zaznacza, że następne otwarcie arkusza ma włączyć dyktowanie. */
export function requestVoiceOnOpen() { voiceRequested = true; }

/** Odczytuje i zeruje żądanie dyktowania (jednorazowe, żeby kolejne otwarcie nie nagrywało samo). */
export function takeVoiceRequest(): boolean {
  const v = voiceRequested;
  voiceRequested = false;
  return v;
}

/** Id wpisu dodanego przed chwilą (podświetlenie na osi czasu); czytane przy montażu wiersza. */
export const freshEntry: { id: string | null } = { id: null };
