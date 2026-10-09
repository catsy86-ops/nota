import { useSyncExternalStore } from "react";
import { yjsStore } from "@/lib/yjsStore";
import { logDiag } from "@/lib/diagnostics";
import { migrate, type DayEntry, type SettlementMonths, type ShiftData, type ShiftPattern, type ShiftType, type WorkSystem } from "./model";
import { applyPattern } from "./pattern";
import { createYShifts, type DeletedShiftType } from "./yShifts";

/**
 * Grafik żyje w dokumencie Yjs notatek (`yShifts.ts`), więc synchronizuje się
 * razem z nimi. Komponenty czytają przez `useShifts()` i zmieniają wyłącznie
 * akcjami poniżej.
 */
const yShifts = createYShifts(yjsStore.doc);

/** Dawny zapis Grafiku w localStorage — dziś tylko źródło jednorazowej migracji. */
export const SHIFTS_STORAGE_KEY = "kaczy:shifts";
const DEVICE_KEY = `${SHIFTS_STORAGE_KEY}.device`;

/**
 * Przenosi stary zapis do dokumentu — raz na urządzenie, scalając z tym, co
 * już przyszło z innych urządzeń. Znacznik „to urządzenie już przeniesione”
 * siedzi w dokumencie, nie w localStorage: flaga zapisana od razu, przy
 * zamknięciu karty przed zapisem do IndexedDB, zgubiłaby grafik z widoku.
 * Stary klucz zostaje jako kopia.
 */
function migrateFromLocalStorage(): void {
  try {
    const raw = localStorage.getItem(SHIFTS_STORAGE_KEY);
    if (!raw) return;
    let device = localStorage.getItem(DEVICE_KEY);
    if (!device) { device = newShiftId("dev-"); localStorage.setItem(DEVICE_KEY, device); }
    if (yShifts.isMerged(device)) return;
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { parsed = undefined; }
    if (parsed === undefined) {
      logDiag("error", "shifts", `uszkodzony stary grafik — zostaje w ${SHIFTS_STORAGE_KEY}`);
      return;
    }
    yShifts.mergeIn(migrate(parsed), device);
    logDiag("info", "shifts", "grafik przeniesiony z localStorage do Yjs");
  } catch (err) {
    logDiag("error", "shifts", "migracja grafiku nie powiodła się", err);
  }
}

let ready = false;
const readyListeners = new Set<() => void>();
const readyPromise = yjsStore.ready().then(() => {
  migrateFromLocalStorage();
  ready = true;
  readyListeners.forEach((l) => l());
});

/** Czeka na wczytanie dokumentu i migrację (testy, kopia zapasowa). */
export const shiftsReady = () => readyPromise;

export const shiftStore = {
  get: yShifts.get,
  subscribe: yShifts.subscribe,
};

export const useShifts = () => useSyncExternalStore(yShifts.subscribe, yShifts.get);

/** Czy dokument jest już wczytany — wcześniej widok pokazałby pusty grafik. */
export const useShiftsReady = () => useSyncExternalStore(
  (cb) => { readyListeners.add(cb); return () => readyListeners.delete(cb); },
  () => ready,
);

export const setDayShift = yShifts.setDayShift;
export const setDayEntry = yShifts.setDayEntry;

/** Poprzednie wartości zmienionych dni (`null` = dzień był pusty) — dla „Cofnij”. */
export type DaysBefore = Record<string, DayEntry | null>;

/** Nakłada cykl; zwraca poprzednie wartości dni, które się zmieniły. */
export function applyPatternToStore(steps: (string | null)[], startKey: string, length: number): DaysBefore {
  const current = yShifts.get().days;
  const next = applyPattern(current, steps, startKey, length);
  const changed: DaysBefore = {};
  for (const k of new Set([...Object.keys(current), ...Object.keys(next)])) {
    if (current[k] !== next[k]) changed[k] = next[k] ?? null;
  }
  return yShifts.writeDays(changed);
}

/** Przywraca dni zwrócone przez `applyPatternToStore`. */
export function restoreDays(before: DaysBefore): void {
  yShifts.writeDays(before);
}

export const saveShiftType: (type: ShiftType) => void = yShifts.saveShiftType;
export const deleteShiftType: (id: string) => DeletedShiftType | null = yShifts.deleteShiftType;
export const restoreShiftType = yShifts.restoreShiftType;
export const addDefaultShiftTypes = yShifts.addDefaultShiftTypes;
export type { DeletedShiftType };

/** Cały Grafik naraz — przywrócenie kopii zapasowej. */
export function restoreShifts(data: ShiftData): void {
  yShifts.replaceAll(migrate(data));
}

export const savePattern: (pattern: ShiftPattern) => void = yShifts.savePattern;
export const deletePattern = yShifts.deletePattern;

const positive = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

export function setHourlyRate(rate: number): void {
  yShifts.setMeta("hourlyRate", positive(rate));
}

export function setWorkSystem(workSystem: WorkSystem): void {
  yShifts.setMeta("workSystem", workSystem);
}

export function setSettlementMonths(months: SettlementMonths): void {
  yShifts.setMeta("settlementMonths", months);
}

/** Losowe id — `Date.now()` z dwóch telefonów w tej samej milisekundzie dałby kolizję po scaleniu. */
export function newShiftId(prefix: string): string {
  return `${prefix}${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}
