import { useSyncExternalStore } from "react";
import { yjsStore } from "@/lib/yjsStore";
import { logDiag } from "@/lib/diagnostics";
import { migrate, type DayEntry, type SettlementMonths, type ShiftBonus, type ShiftData, type ShiftPattern, type ShiftType, type WorkSystem } from "./model";
import { applyPattern } from "./pattern";
import { planPaste, planTransfer, planWeekCopy, type TransferMode, type WeekCopyPlan } from "./move";
import { createYShifts, MAIN_SCHEDULE_ID, SHIFTS_SYSTEM_ORIGIN, type DeletedShiftType, type YShifts } from "./yShifts";
import { createScheduleRegistry, isScheduleId, type ShiftSchedule } from "./schedules";

/**
 * Grafik żyje w dokumencie Yjs notatek (`yShifts.ts`), więc synchronizuje się
 * razem z nimi. Komponenty czytają przez `useShifts()` i zmieniają wyłącznie
 * akcjami poniżej.
 *
 * Grafików może być kilka (`schedules.ts`). Aktywny jest jeden naraz — wybór
 * trzymamy w tym urządzeniu (localStorage), bo to preferencja widoku, nie dane.
 * Wszystkie akcje działają na aktywnym grafiku; `yShifts` przepinane jest przy zmianie.
 */
const yjsDoc = yjsStore.doc;
const registry = createScheduleRegistry(yjsDoc);
// Literał, nie `SHIFTS_STORAGE_KEY`: ta stała jest niżej w pliku, a tu liczymy wartość od razu.
const ACTIVE_KEY = "kaczy:shifts.active";

function readActiveId(): string {
  try {
    return localStorage.getItem(ACTIVE_KEY) || MAIN_SCHEDULE_ID;
  } catch {
    return MAIN_SCHEDULE_ID;
  }
}

let activeId = readActiveId();
// L12: jedna instancja na grafik — każde createYShifts dokłada obserwatory do dokumentu.
const instances = new Map<string, YShifts>();
const instanceFor = (id: string): YShifts => {
  let inst = instances.get(id);
  if (!inst) { inst = createYShifts(yjsDoc, id); instances.set(id, inst); }
  return inst;
};

let yShifts: YShifts = instanceFor(activeId);
const storeListeners = new Set<() => void>();
const emitStore = () => storeListeners.forEach((l) => l());
const subscribeStore = (cb: () => void) => {
  storeListeners.add(cb);
  return () => { storeListeners.delete(cb); };
};
let unsubscribeActive = yShifts.subscribe(emitStore);

/** Przepina aktywny grafik: zapamiętuje wybór w tym urządzeniu i powiadamia widoki. */
function bindSchedule(id: string): void {
  unsubscribeActive();
  activeId = id;
  yShifts = instanceFor(id);
  unsubscribeActive = yShifts.subscribe(emitStore);
  try { localStorage.setItem(ACTIVE_KEY, id); } catch { /* prywatne okno — wybór zostanie w pamięci */ }
  emitStore();
}

/** Grafik główny niezależnie od aktywnego — dla kopii i migracji. */
const mainShifts = () => instanceFor(MAIN_SCHEDULE_ID);

// H1: aktywny grafik może zniknąć na innym urządzeniu (synchronizacja przychodzi w trakcie pracy).
// Wtedy wracamy do głównego — inaczej zmiany trafiałyby do osieroconych map.
registry.subscribe(() => {
  if (activeId !== MAIN_SCHEDULE_ID && !registry.has(activeId)) bindSchedule(MAIN_SCHEDULE_ID);
});

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
    if (mainShifts().isMerged(device)) return;
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { parsed = undefined; }
    if (parsed === undefined) {
      logDiag("error", "shifts", `uszkodzony stary grafik — zostaje w ${SHIFTS_STORAGE_KEY}`);
      return;
    }
    mainShifts().mergeIn(migrate(parsed), device);
    logDiag("info", "shifts", "grafik przeniesiony z localStorage do Yjs");
  } catch (err) {
    logDiag("error", "shifts", "migracja grafiku nie powiodła się", err);
  }
}

let ready = false;
const readyListeners = new Set<() => void>();
const readyPromise = yjsStore.ready().then(() => {
  migrateFromLocalStorage();
  // Praca na budowie (10 h) — dodana do rodzajów startowych 2026-10-09.
  mainShifts().addPresetOnce("presetBudowa", "b");
  // Dniówka 8–16 — dodana 2026-10-09.
  mainShifts().addPresetOnce("presetDniowka", "e");
  // Zapamiętany grafik mógł zniknąć (usunięty na innym urządzeniu) — wtedy wracamy do głównego.
  if (activeId !== MAIN_SCHEDULE_ID && !registry.has(activeId)) bindSchedule(MAIN_SCHEDULE_ID);
  // Dokument jest już wczytany — widoki czytające grafik mają przeliczyć się na właściwych danych.
  emitStore();
  ready = true;
  readyListeners.forEach((l) => l());
});

/** Czeka na wczytanie dokumentu i migrację (testy, kopia zapasowa). */
export const shiftsReady = () => readyPromise;

/** Aktywny grafik (widoki) — kopia zapasowa używa `mainShiftData` i `scheduleDump`. */
export const shiftStore = {
  get: () => yShifts.get(),
  subscribe: subscribeStore,
};

export const useShifts = () => useSyncExternalStore(subscribeStore, () => yShifts.get());

/** Grafik główny niezależnie od wyboru widoku — trafia do kopii jako `shifts`. */
export const mainShiftData = (): ShiftData => mainShifts().get();

/** Czy dokument jest już wczytany — wcześniej widok pokazałby pusty grafik. */
export const useShiftsReady = () => useSyncExternalStore(
  (cb) => { readyListeners.add(cb); return () => readyListeners.delete(cb); },
  () => ready,
);

export const setDayShift: YShifts["setDayShift"] = (...args) => yShifts.setDayShift(...args);
export const setDayEntry: YShifts["setDayEntry"] = (...args) => yShifts.setDayEntry(...args);

/** Poprzednie wartości zmienionych dni (`null` = dzień był pusty) — dla „Cofnij”. */
export type DaysBefore = Record<string, DayEntry | null>;

/** Nakłada cykl; zwraca poprzednie wartości dni, które się zmieniły. */
export function applyPatternToStore(steps: (string | null)[], startKey: string, length: number, anchorKey?: string): DaysBefore {
  const current = yShifts.get().days;
  const next = applyPattern(current, steps, startKey, length, anchorKey);
  const changed: DaysBefore = {};
  for (const k of new Set([...Object.keys(current), ...Object.keys(next)])) {
    if (current[k] !== next[k]) changed[k] = next[k] ?? null;
  }
  return yShifts.writeDays(changed);
}

/** Przywraca dni zwrócone przez `applyPatternToStore`. */
export function restoreDays(before: DaysBefore): void {
  yShifts.writeDays(before, SHIFTS_SYSTEM_ORIGIN);
}

/** Cofa ostatnią lokalną zmianę w Grafiku (Ctrl+Z). `false`, gdy nie ma czego cofać. */
export const undoShifts = (): boolean => yShifts.undo();
export const canUndoShifts = (): boolean => yShifts.canUndo();

/** Przenosi albo kopiuje wpis dnia; zwraca poprzednie wartości dni (do „Cofnij”) albo `null`, gdy nic się nie zmieniło. */
export function transferDay(from: string, to: string, mode: TransferMode, todayKey: string): DaysBefore | null {
  const plan = planTransfer(yShifts.get().days, from, to, mode, todayKey);
  return plan ? yShifts.writeDays(plan) : null;
}

/** Wkleja wpis ze schowka na dzień; zwraca poprzednie wartości dni albo `null`, gdy dzień ma już taki wpis. */
export function pasteDay(entry: DayEntry, to: string, todayKey: string): DaysBefore | null {
  const plan = planPaste(yShifts.get().days, entry, to, todayKey);
  return plan ? yShifts.writeDays(plan) : null;
}

/** Kopiuje tydzień z dniem `weekOf` na następny (po potwierdzeniu nadpisań w UI). */
export function copyWeekToNext(weekOf: string, todayKey: string): { before: DaysBefore; plan: WeekCopyPlan } | null {
  const plan = planWeekCopy(yShifts.get().days, weekOf, todayKey);
  if (plan.copied === 0) return null;
  return { before: yShifts.writeDays(plan.changes), plan };
}

export const saveShiftType = (type: ShiftType): void => yShifts.saveShiftType(type);
export const deleteShiftType = (id: string): DeletedShiftType | null => yShifts.deleteShiftType(id);
export const restoreShiftType: YShifts["restoreShiftType"] = (...args) => yShifts.restoreShiftType(...args);
export const addDefaultShiftTypes: YShifts["addDefaultShiftTypes"] = (...args) => yShifts.addDefaultShiftTypes(...args);
export type { DeletedShiftType };

/** Cały Grafik naraz — przywrócenie kopii zapasowej. */
export function restoreShifts(data: ShiftData, bonusesProvided = true): void {
  const main = mainShifts();
  // M8: kopia sprzed premii nie ma ich w pliku — zachowujemy premie dodane na tym telefonie.
  const keep = bonusesProvided ? [] : main.get().bonuses;
  main.replaceAll(migrate(data));
  for (const b of keep) main.saveBonus(b);
}

export const savePattern = (pattern: ShiftPattern): void => yShifts.savePattern(pattern);
export const deletePattern = (id: string): void => yShifts.deletePattern(id);
/** Premie w rachunku: zapis (dodanie albo poprawka), usunięcie zwraca premię do cofnięcia. */
export const saveBonus = (bonus: ShiftBonus): boolean => yShifts.saveBonus(bonus);
export const deleteBonus = (id: string): ShiftBonus | null => yShifts.deleteBonus(id);

const positive = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

export function setHourlyRate(rate: number): void {
  yShifts.setMeta("hourlyRate", positive(rate));
}

/** Dodatek nocny w zł/h; 0 = liczony z minimalnej stawki roku. */
export function setNightRate(rate: number): void {
  yShifts.setMeta("nightRate", positive(rate));
}

export function setWorkSystem(workSystem: WorkSystem): void {
  yShifts.setMeta("workSystem", workSystem);
}

export function setSettlementMonths(months: SettlementMonths): void {
  yShifts.setMeta("settlementMonths", months);
}

/** Pierwszy miesiąc okresów rozliczeniowych (0–11). */
export function setSettlementStart(month: number): void {
  yShifts.setMeta("settlementStart", Number.isInteger(month) && month >= 0 && month < 12 ? month : 0);
}

export function setFte(fte: number): void {
  yShifts.setMeta("fte", fte > 0 && fte <= 1 ? fte : 1);
}

/** Roczny wymiar urlopu w dniach (0–99, całkowite); nieprawidłowa wartość wraca do 20. */
export function setLeaveDays(days: number): void {
  yShifts.setMeta("leaveDays", Number.isInteger(days) && days >= 0 && days <= 99 ? days : 20);
}

/** Umowna granica nadgodzin przy niepełnym etacie (art. 151 § 5 KP) jako wymiar etatu. */
export function setOvertimeFrom(fte: number): void {
  yShifts.setMeta("overtimeFrom", fte > 0 && fte <= 1 ? fte : 1);
}

/** Godzina początku doby niedzieli i święta (art. 151¹⁰ KP), 0–23. */
export function setSundayFrom(hour: number): void {
  yShifts.setMeta("sundayFrom", Number.isInteger(hour) && hour >= 0 && hour < 24 ? hour : 6);
}

/** Początek pory nocnej (art. 151⁷ KP): 21, 22 albo 23. */
export function setNightFrom(hour: number): void {
  yShifts.setMeta("nightFrom", hour === 21 || hour === 23 ? hour : 22);
}

/** Losowe id — `Date.now()` z dwóch telefonów w tej samej milisekundzie dałby kolizję po scaleniu. */
export function newShiftId(prefix: string): string {
  return `${prefix}${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

/** Lista grafików (główny pierwszy). Stabilny obiekt, dopóki lista się nie zmieni. */
export const useSchedules = (): ShiftSchedule[] => useSyncExternalStore(registry.subscribe, registry.list);

export const activeScheduleId = (): string => activeId;

/** Id aktywnego grafiku jako stan dla widoku (zmienia się przy przełączeniu). */
export const useActiveScheduleId = (): string => useSyncExternalStore(subscribeStore, () => activeId);

/** Przełącza widok na inny grafik; nieznany id zostaje bez zmian. */
export function setActiveSchedule(id: string): void {
  if (id === activeId || !registry.has(id)) return;
  bindSchedule(id);
}

/** Nowy grafik (pusty). `null` = pusta nazwa albo limit grafików. */
export function createSchedule(name: string): ShiftSchedule | null {
  return registry.add(name);
}

export function renameSchedule(id: string, name: string): boolean {
  return registry.rename(id, name);
}

/** Usuwa grafik z danymi. Główny nie da się usunąć; gdy był aktywny, wraca widok do głównego. */
export function removeSchedule(id: string): boolean {
  if (!registry.remove(id)) return false;
  if (id === activeId) bindSchedule(MAIN_SCHEDULE_ID);
  else emitStore();
  return true;
}

/** Zrzut danych jednego grafiku (dla kopii zapasowej). */
export function scheduleDump(id: string): ShiftData {
  return instanceFor(id).get();
}

/** Grafiki poza głównym, z nazwami — do kopii zapasowej. */
export function extraSchedulesDump(): { id: string; name: string; data: ShiftData }[] {
  return registry.list().filter((s) => s.id !== MAIN_SCHEDULE_ID).map((s) => ({ id: s.id, name: s.name, data: scheduleDump(s.id) }));
}

/**
 * Przywraca dodatkowy grafik z kopii: tworzy go pod tym samym id i dokłada brakujące dane (bez kasowania).
 * Zwraca `false`, gdy nie ma już miejsca na nowy grafik.
 */
export function restoreExtraSchedule(id: string, name: string, data: ShiftData): boolean {
  // M5: id z pliku trafia do nazw map — tylko format nadawany przez `createSchedule`, nigdy „main”.
  if (id === MAIN_SCHEDULE_ID || !isScheduleId(id)) return false;
  if (!registry.has(id)) {
    if (!registry.add(name, id)) return false;
  }
  instanceFor(id).mergeIn(migrate(data));
  return true;
}