import { createPersistedStore } from "@/lib/persistedStore";
import { EMPTY_SHIFT_DATA, migrate, type DayEntry, type ShiftData, type ShiftPattern, type ShiftType } from "./model";
import { applyPattern } from "./pattern";

/**
 * Jeden dokument Grafiku w localStorage. Komponenty czytają przez
 * `useShifts()` i zmieniają wyłącznie akcjami poniżej — każda składa nowy
 * obiekt, więc `useSyncExternalStore` widzi zmianę, a stare wersje nadają
 * się do cofania.
 */
export const SHIFTS_STORAGE_KEY = "kaczy:shifts";

export const shiftStore = createPersistedStore<ShiftData>(SHIFTS_STORAGE_KEY, EMPTY_SHIFT_DATA, {
  merge: (_defaults, stored) => migrate(stored),
});

export const useShifts = () => shiftStore.use();

const update = (fn: (d: ShiftData) => ShiftData) => shiftStore.set(fn(shiftStore.get()));

/** Ustawia zmianę na dzień; `null` czyści dzień. Ta sama zmiana zachowuje notatkę i odchylenie. */
export function setDayShift(dayKey: string, typeId: string | null): void {
  update((d) => {
    const days = { ...d.days };
    if (!typeId) delete days[dayKey];
    else if (days[dayKey]?.type !== typeId) days[dayKey] = { ...days[dayKey], type: typeId };
    return { ...d, days };
  });
}

/** Zapisuje pełny wpis dnia (rodzaj, notatka, odchylenie); `null` czyści dzień. */
export function setDayEntry(dayKey: string, entry: DayEntry | null): void {
  update((d) => {
    const days = { ...d.days };
    if (entry) days[dayKey] = entry;
    else delete days[dayKey];
    return { ...d, days };
  });
}

/** Nakłada cykl; zwraca poprzednie dni, żeby wywołujący mógł zaproponować „Cofnij”. */
export function applyPatternToStore(steps: (string | null)[], startKey: string, length: number): Record<string, DayEntry> {
  const before = shiftStore.get().days;
  update((d) => ({ ...d, days: applyPattern(d.days, steps, startKey, length) }));
  return before;
}

export function restoreDays(days: Record<string, DayEntry>): void {
  update((d) => ({ ...d, days }));
}

export function saveShiftType(type: ShiftType): void {
  update((d) => ({
    ...d,
    types: d.types.some((t) => t.id === type.id) ? d.types.map((t) => (t.id === type.id ? type : t)) : [...d.types, type],
  }));
}

/**
 * Usuwa rodzaj zmiany razem z jego dniami i krokami w cyklach.
 * Zwraca cały poprzedni stan — dla „Cofnij” (`restoreShifts`).
 */
export function deleteShiftType(id: string): ShiftData {
  const before = shiftStore.get();
  update((d) => ({
    ...d,
    types: d.types.filter((t) => t.id !== id),
    days: Object.fromEntries(Object.entries(d.days).filter(([, e]) => e.type !== id)),
    patterns: d.patterns.map((p) => ({ ...p, steps: p.steps.map((s) => (s === id ? null : s)) })),
  }));
  return before;
}

export function restoreShifts(data: ShiftData): void {
  shiftStore.set(data);
}

export function savePattern(pattern: ShiftPattern): void {
  update((d) => ({
    ...d,
    patterns: d.patterns.some((p) => p.id === pattern.id) ? d.patterns.map((p) => (p.id === pattern.id ? pattern : p)) : [...d.patterns, pattern],
  }));
}

export function deletePattern(id: string): void {
  update((d) => ({ ...d, patterns: d.patterns.filter((p) => p.id !== id) }));
}

const positive = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

export function setHourlyRate(rate: number): void {
  update((d) => ({ ...d, hourlyRate: positive(rate) }));
}

export function setOvertimeMultiplier(m: number): void {
  update((d) => ({ ...d, overtimeMultiplier: Math.max(1, positive(m) || 1) }));
}
