import { DEFAULT_SHIFT_TYPES, EMPTY_SHIFT_DATA, type ShiftData, type ShiftType } from "./model";

/**
 * Tylko do testów. Dawne domyślne zmiany 6–14, 14–22 i nocna zniknęły z `DEFAULT_SHIFT_TYPES`
 * (2026-10-27), a testy logiki o nich nadal opowiadają (doba pracownicza, noc, patterny).
 * Dane, których te testy używają, nie zależą więc od tego, co startowo widzi użytkownik.
 */
const LEGACY_SHIFT_TYPES: ShiftType[] = [
  { id: "d", name: "Dzień", short: "D", color: "#fb923c", start: "06:00", end: "14:00", breakMin: 0, kind: "work" },
  { id: "p", name: "Popołudnie", short: "P", color: "#3b82f6", start: "14:00", end: "22:00", breakMin: 0, kind: "work" },
  { id: "n", name: "Noc", short: "N", color: "#4f46e5", start: "22:00", end: "06:00", breakMin: 0, kind: "work" },
];

/** Dawny zestaw domyślny: najpierw trzy zmiany, potem bieżące domyślne (urlopy, 8 h, 10 h). */
export const TEST_SHIFT_TYPES: ShiftType[] = [...LEGACY_SHIFT_TYPES, ...DEFAULT_SHIFT_TYPES];

/** Pusty stan danych z dawnym zestawem zmian — zamiennik `EMPTY_SHIFT_DATA` w testach. */
export const TEST_EMPTY_SHIFT_DATA: ShiftData = { ...EMPTY_SHIFT_DATA, types: TEST_SHIFT_TYPES };
