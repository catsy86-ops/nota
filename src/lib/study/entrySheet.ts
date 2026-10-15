import { useSyncExternalStore } from "react";

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
}

let state: JournalSheetState = { open: false, topicFirst: false };
const listeners = new Set<() => void>();

function set(next: JournalSheetState) {
  if (state.open === next.open && state.topicFirst === next.topicFirst) return;
  state = next;
  listeners.forEach((l) => l());
}

export const openJournalSheet = (topicFirst = false) => set({ open: true, topicFirst });
export const closeJournalSheet = () => set({ open: false, topicFirst: false });

export const useJournalSheet = () => useSyncExternalStore(
  (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
  () => state,
);

/** Parametr adresu ze skrótu PWA „Wpis z budowy” (`/nauka?wpis=1`). */
export const JOURNAL_ENTRY_PARAM = "wpis";
