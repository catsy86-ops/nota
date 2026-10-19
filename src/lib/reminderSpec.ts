import type { ReminderRepeat } from "./reminderRepeat";

/**
 * Przypomnienie notatki jako jedna wartość (`reminderSpec` w Y.Map notatki).
 *
 * Dawniej termin, powtarzanie, dzień serii i koniec były czterema osobnymi polami z własnym
 * rozstrzyganiem konfliktów (LWW). Dwa urządzenia edytujące ten sam termin naraz mogły zostawić
 * niezgodną mieszankę (np. nowy termin ze starym dniem serii). Teraz całe przypomnienie
 * przechodzi jako jeden zapis: konflikt wygrywa w całości.
 *
 * Starsze pola (`reminder`, `reminderRepeat`, …) nadal są zapisywane tą samą wartością dla
 * starszych odczytów. Odczyt najpierw bierze `reminderSpec`, a gdy go nie ma — pola (notatki sprzed zmiany).
 */

const REPEATS: readonly ReminderRepeat[] = ["none", "daily", "weekly", "monthly"];

export const REMINDER_FIELDS = ["reminder", "reminderRepeat", "reminderDay", "reminderRepeatUntil", "reminderAllDay"] as const;

export interface ReminderState {
  reminder: number | null;
  reminderRepeat?: ReminderRepeat;
  reminderDay?: number;
  reminderRepeatUntil?: number;
  /** Cały dzień: `reminder` to wtedy 9:00 tego dnia (domyślna godzina), a UI pokazuje samą datę. */
  reminderAllDay?: boolean;
}

/** Zapisany kształt: bez pól `undefined`, żeby Yjs i JSON się zgadzały. */
export type ReminderSpec = ReminderState;

/** Stan przypomnienia z zapisanej wartości; `undefined` pola są pomijane. */
export function specOf(state: ReminderState): ReminderSpec {
  const out: ReminderSpec = { reminder: state.reminder };
  if (state.reminderRepeat !== undefined) out.reminderRepeat = state.reminderRepeat;
  if (state.reminderDay !== undefined) out.reminderDay = state.reminderDay;
  if (state.reminderRepeatUntil !== undefined) out.reminderRepeatUntil = state.reminderRepeatUntil;
  // Flaga zapisana tylko gdy prawdziwa: brak pola = zwykły termin z godziną.
  if (state.reminderAllDay === true) out.reminderAllDay = true;
  return out;
}

/**
 * Nowy stan po zmianie: pola obecne w `updates` (także jawne `undefined` = wyczyść) nadpisują
 * bieżące; reszta zostaje. Wynik to całość przypomnienia, gotowa do jednego zapisu.
 */
export function mergeSpec(current: ReminderState, updates: Partial<ReminderState>): ReminderSpec {
  const next: Record<string, unknown> = { ...current };
  for (const f of REMINDER_FIELDS) {
    if (f in updates) next[f] = (updates as Record<string, unknown>)[f];
  }
  return specOf(next as unknown as ReminderState);
}

/** Dowolna wartość z dokumentu (peer, starszy zapis) → poprawny `ReminderSpec` albo `null`. */
export function readSpec(raw: unknown): ReminderSpec | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<Record<keyof ReminderSpec, unknown>>;
  if (!(r.reminder === null || (typeof r.reminder === "number" && Number.isFinite(r.reminder)))) return null;
  const spec: ReminderSpec = { reminder: r.reminder as number | null };
  if (typeof r.reminderRepeat === "string" && (REPEATS as readonly string[]).includes(r.reminderRepeat)) spec.reminderRepeat = r.reminderRepeat as ReminderRepeat;
  if (typeof r.reminderDay === "number" && Number.isInteger(r.reminderDay) && r.reminderDay >= 1 && r.reminderDay <= 31) spec.reminderDay = r.reminderDay;
  if (typeof r.reminderRepeatUntil === "number" && Number.isFinite(r.reminderRepeatUntil)) spec.reminderRepeatUntil = r.reminderRepeatUntil;
  if (r.reminderAllDay === true) spec.reminderAllDay = true;
  return spec;
}

/** Przypomnienie do odczytu: `reminderSpec`, a bez niego — pola sprzed zmiany. */
export function projectReminder(spec: ReminderSpec | null, legacy: ReminderState): ReminderState {
  return spec ? specOf(spec) : specOf(legacy);
}
