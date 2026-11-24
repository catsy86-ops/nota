import { TEST_TOPICS } from "./pressureTest";
import type { JournalDraft } from "./draft";

/**
 * Sekcje i okna arkusza wpisu (R2.1): które są otwarte ręcznie. Jeden reduktor zamiast kilkunastu `useState`.
 * Sekcja z danymi (np. wpisane kształtki) jest widoczna i „wymuszona” niezależnie od przełącznika —
 * liczy to `entrySections` z formularza, więc stan reduktora nie musi śledzić danych.
 */

export const ENTRY_PANELS = ["test", "fittings", "pipes", "level", "barcode", "ai", "nfc", "kits", "kitsDialog", "topic"] as const;
export type EntryPanel = (typeof ENTRY_PANELS)[number];
export type PanelsState = Readonly<Record<EntryPanel, boolean>>;

export type PanelsAction =
  | { type: "toggle"; panel: EntryPanel }
  | { type: "set"; panel: EntryPanel; open: boolean };

export const CLOSED_PANELS: PanelsState = Object.fromEntries(ENTRY_PANELS.map((p) => [p, false])) as Record<EntryPanel, boolean>;

export function panelsReducer(state: PanelsState, action: PanelsAction): PanelsState {
  const next = action.type === "toggle" ? !state[action.panel] : action.open;
  return state[action.panel] === next ? state : { ...state, [action.panel]: next };
}

type SectionForm = Pick<JournalDraft, "topic" | "test" | "fittings" | "pipes" | "level" | "barcode" | "summary">;

export interface SectionState {
  /** Sekcja na ekranie. */
  visible: boolean;
  /** Widoczna, bo ma dane — przełącznik jej nie schowa. */
  forced: boolean;
}

/** Widoczność sekcji z danymi: otwarta ręcznie albo wymuszona przez to, co już jest we wpisie. */
export function entrySections(open: PanelsState, form: SectionForm): Record<"test" | "fittings" | "pipes" | "level" | "barcode" | "ai", SectionState> {
  const s = (panel: EntryPanel, forced: boolean): SectionState => ({ visible: open[panel] || forced, forced });
  return {
    test: s("test", !!form.test || TEST_TOPICS.has(form.topic)),
    fittings: s("fittings", (form.fittings?.length ?? 0) > 0),
    pipes: s("pipes", (form.pipes?.length ?? 0) > 0),
    level: s("level", form.level !== undefined),
    barcode: s("barcode", form.barcode !== undefined),
    ai: s("ai", form.summary !== undefined),
  };
}
