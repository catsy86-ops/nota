import * as Y from "yjs";
import { BONUS_MAX_PER_DATA, cleanBonus, DEFAULT_LEAVE_DAYS, DEFAULT_PATTERNS, DEFAULT_SHIFT_TYPES, migrate, shiftHours, type DayEntry, type SettlementMonths, type ShiftBonus, type ShiftData, type ShiftPattern, type ShiftType, type WorkSystem } from "./model";

/**
 * Grafik w Y.Doc — tym samym, który niosą synchronizacja P2P i plik, więc
 * zmiany przechodzą między urządzeniami bez osobnego transportu.
 *
 * Każdy dzień, rodzaj i cykl to osobny wpis mapy (wartość = zwykły obiekt):
 * dwa telefony malujące różne dni scalają się bez strat, a ten sam dzień
 * wygrywa jedna wersja w całości. Rodzaje i cykle niosą `order`, bo kolejność
 * kluczy w Y.Map nie jest ta sama na każdym urządzeniu.
 *
 * Rodzaje i cykle startowe nie są zapisywane, dopóki ktoś ich nie zmieni
 * (`typesInit`/`patternsInit`) — świeże urządzenie, które zapisałoby domyślne
 * od razu, mogłoby przy scaleniu nadpisać czyjeś poprawki tych samych id.
 */

type Meta = "hourlyRate" | "nightRate" | "workSystem" | "settlementMonths" | "settlementStart" | "fte" | "leaveDays" | "overtimeFrom" | "sundayFrom" | "nightFrom" | "typesInit" | "patternsInit" | "presetBudowa" | "presetDniowka";

/** Origin transakcji Grafiku — odróżnia lokalne zmiany od tych z sieci i z migracji. */
/** Zmiany bez cofania: import, przywracanie kopii, migracje i Cofnij z tostu. Nie trafiają na stos Ctrl+Z. */
export const SHIFTS_SYSTEM_ORIGIN = "shifts-system";
export const SHIFTS_ORIGIN = "shifts";

/** Do „Cofnij” po usunięciu rodzaju: tylko to, co usunięcie zabrało. */
export interface DeletedShiftType {
  type: ShiftType;
  days: Record<string, DayEntry>;
  patterns: ShiftPattern[];
}

const localDayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const byOrder = <T extends { order?: number }>(a: T, b: T) => (a.order ?? 0) - (b.order ?? 0);

/** Nazwy map jednego grafiku (bez prefiksu). Pierwszy grafik („main”) używa ich wprost — dane sprzed wielu grafików zostają na miejscu. */
export const SHIFTS_MAP_BASE_NAMES = ["shiftTypes", "shiftDays", "shiftPatterns", "shiftBonuses", "shiftMeta", "shiftMigrations"] as const;
export const MAIN_SCHEDULE_ID = "main";

/** Nazwa mapy dla danego grafiku: „main” bez prefiksu, pozostałe z identyfikatorem. */
export function shiftsMapName(scheduleId: string, base: (typeof SHIFTS_MAP_BASE_NAMES)[number]): string {
  return scheduleId === MAIN_SCHEDULE_ID ? base : `${scheduleId}:${base}`;
}

/** Grafik jako zestaw map w dokumencie. Każdy grafik ma własne `types`, `days`, cykle, premie i migracje. */
export function createYShifts(doc: Y.Doc, scheduleId: string = MAIN_SCHEDULE_ID) {
  const types = doc.getMap<ShiftType>(shiftsMapName(scheduleId, "shiftTypes"));
  const days = doc.getMap<DayEntry>(shiftsMapName(scheduleId, "shiftDays"));
  const patterns = doc.getMap<ShiftPattern>(shiftsMapName(scheduleId, "shiftPatterns"));
  const bonuses = doc.getMap<ShiftBonus>(shiftsMapName(scheduleId, "shiftBonuses"));
  const meta = doc.getMap<unknown>(shiftsMapName(scheduleId, "shiftMeta"));
  /** Urządzenia, których stary zapis jest już w dokumencie (id urządzenia → czas). */
  const migrations = doc.getMap<number>(shiftsMapName(scheduleId, "shiftMigrations"));

  let snapshot: ShiftData | null = null;
  const listeners = new Set<() => void>();
  const onChange = () => {
    snapshot = null;
    listeners.forEach((l) => l());
  };
  for (const m of [types, days, patterns, bonuses, meta]) m.observe(onChange);

  /** Projekcja dokumentu na `ShiftData`, przez `migrate` — śmieci od peera nie wywrócą widoku. */
  function get(): ShiftData {
    if (snapshot) return snapshot;
    const settings: Record<string, unknown> = {};
    for (const k of ["hourlyRate", "nightRate", "workSystem", "settlementMonths", "settlementStart", "fte", "leaveDays", "overtimeFrom", "sundayFrom", "nightFrom"] as const) if (meta.has(k)) settings[k] = meta.get(k);
    snapshot = migrate({
      version: 2,
      ...settings,
      types: meta.get("typesInit") ? Array.from(types.values()).sort(byOrder) : undefined,
      patterns: meta.get("patternsInit") ? Array.from(patterns.values()).sort(byOrder) : undefined,
      days: Object.fromEntries(days.entries()),
      bonuses: Array.from(bonuses.values()),
    });
    return snapshot;
  }

  function subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }

  const transact = (fn: () => void, origin: string = SHIFTS_ORIGIN) => doc.transact(fn, origin);
  const transactSystem = (fn: () => void) => doc.transact(fn, SHIFTS_SYSTEM_ORIGIN);

  // Cofnij (Ctrl+Z) dla Grafiku: tylko lokalne zmiany dni. Zmiany z innego urządzenia (origin dostawcy)
  // i zapisy systemowe nie są śledzone, więc Ctrl+Z nie cofa cudzych ani importowanych danych.
  const undoManager = new Y.UndoManager([days], { trackedOrigins: new Set([SHIFTS_ORIGIN]), captureTimeout: 400 });

  /** Przed pierwszą zmianą rodzajów zapisuje widoczne startowe — od teraz żyją w dokumencie. */
  function ensureTypes() {
    if (meta.get("typesInit")) return;
    DEFAULT_SHIFT_TYPES.forEach((t, i) => types.set(t.id, { ...t, order: i }));
    meta.set("typesInit", true);
  }

  function ensurePatterns() {
    if (meta.get("patternsInit")) return;
    DEFAULT_PATTERNS.forEach((p, i) => patterns.set(p.id, { ...p, order: i }));
    meta.set("patternsInit", true);
  }

  const nextOrder = <T extends { order?: number }>(m: Y.Map<T>) => Math.max(-1, ...Array.from(m.values(), (v) => v.order ?? 0)) + 1;

  /**
   * Ustawia zmianę na dzień; `null` czyści dzień. Ta sama zmiana zachowuje
   * notatkę i odchylenie; inna zachowuje tylko notatkę — odchylenie dotyczyło
   * poprzedniej zmiany i po cichu zmieniałoby godziny albo normę.
   */
  function setDayShift(dayKey: string, typeId: string | null): void {
    transact(() => {
      const prev = days.get(dayKey);
      if (!typeId) { if (prev) days.delete(dayKey); return; }
      if (prev?.type === typeId) return;
      days.set(dayKey, prev?.note ? { type: typeId, note: prev.note } : { type: typeId });
    });
  }

  /** Zapisuje pełny wpis dnia (rodzaj, notatka, odchylenie); `null` czyści dzień. */
  function setDayEntry(dayKey: string, entry: DayEntry | null): void {
    transact(() => { if (entry) days.set(dayKey, entry); else days.delete(dayKey); });
  }

  /**
   * Zapisuje zmienione dni z `next` (`null` = wyczyść). Zwraca ich poprzednie
   * wartości — „Cofnij” przywraca tylko te dni, a nie cały grafik, więc nie
   * kasuje tego, co w międzyczasie przyszło z innego urządzenia.
   */
  function writeDays(next: Record<string, DayEntry | null>, origin: string = SHIFTS_ORIGIN): Record<string, DayEntry | null> {
    const before: Record<string, DayEntry | null> = {};
    transact(() => {
      for (const [k, entry] of Object.entries(next)) {
        before[k] = days.get(k) ?? null;
        if (entry) days.set(k, entry);
        else days.delete(k);
      }
    }, origin);
    return before;
  }

  /**
   * Zapisuje rodzaj. Gdy zmieniają się jego godziny, dni sprzed `todayKey`
   * dostają kopię dotychczasowych — wrzesień nie przelicza się po tym, jak
   * „Dzień” od października zaczyna się godzinę później.
   */
  function saveShiftType(type: ShiftType, todayKey = localDayKey(new Date())): void {
    transact(() => {
      const before = get().types.find((t) => t.id === type.id);
      ensureTypes();
      const prev = types.get(type.id);
      if (before && (before.start !== type.start || before.end !== type.end || before.breakMin !== type.breakMin || before.breakAt !== type.breakAt)) {
        const hours = shiftHours(before);
        days.forEach((e, k) => { if (e.type === type.id && k < todayKey && !e.hours) days.set(k, { ...e, hours }); });
      }
      types.set(type.id, { ...type, order: prev?.order ?? type.order ?? nextOrder(types) });
    });
  }

  /** Usuwa rodzaj razem z jego dniami i krokami w cyklach. */
  function deleteShiftType(id: string): DeletedShiftType | null {
    const type = get().types.find((t) => t.id === id);
    if (!type) return null;
    const removed: DeletedShiftType = { type, days: {}, patterns: [] };
    transact(() => {
      ensureTypes();
      ensurePatterns();
      types.delete(id);
      days.forEach((e, k) => { if (e.type === id) removed.days[k] = e; });
      for (const k of Object.keys(removed.days)) days.delete(k);
      patterns.forEach((p) => {
        if (!p.steps.includes(id)) return;
        removed.patterns.push(p);
        patterns.set(p.id, { ...p, steps: p.steps.map((s) => (s === id ? null : s)) });
      });
    });
    return removed;
  }

  /** Odwraca `deleteShiftType`; dni ustawione od tamtej pory na innym urządzeniu zostają. */
  function restoreShiftType({ type, days: removedDays, patterns: removedPatterns }: DeletedShiftType): void {
    transact(() => {
      types.set(type.id, type);
      for (const [k, e] of Object.entries(removedDays)) if (!days.has(k)) days.set(k, e);
      for (const p of removedPatterns) if (patterns.has(p.id)) patterns.set(p.id, p);
    });
  }

  function addDefaultShiftTypes(): void {
    transact(() => {
      ensureTypes();
      let order = nextOrder(types);
      for (const t of DEFAULT_SHIFT_TYPES) if (!types.has(t.id)) types.set(t.id, { ...t, order: order++ });
    });
  }

  /**
   * Jednorazowo dokłada rodzaj startowy dodany w nowszej wersji (np. „Budowa”) do
   * grafiku, który ma już własne rodzaje. Znacznik w dokumencie: usunięty rodzaj
   * nie wraca, a dwa urządzenia dodają ten sam wpis (to samo id). Pusty zestaw
   * rodzajów (ktoś usunął wszystkie) zostaje pusty.
   */
  function addPresetOnce(marker: Extract<Meta, "presetBudowa" | "presetDniowka">, id: string): void {
    if (meta.get(marker)) return;
    const preset = DEFAULT_SHIFT_TYPES.find((t) => t.id === id);
    transact(() => {
      if (preset && meta.get("typesInit") && types.size > 0 && !types.has(id)) types.set(id, { ...preset, order: nextOrder(types) });
      meta.set(marker, true);
    }, "shifts-migration");
  }

  function savePattern(pattern: ShiftPattern): void {
    transact(() => {
      ensurePatterns();
      const prev = patterns.get(pattern.id);
      patterns.set(pattern.id, { ...pattern, order: prev?.order ?? pattern.order ?? nextOrder(patterns) });
    });
  }

  function deletePattern(id: string): void {
    transact(() => { ensurePatterns(); patterns.delete(id); });
  }

  /** Zapis premii (dodanie albo poprawka o tym samym id). `false` = niepoprawne dane albo pełna lista. */
  function saveBonus(bonus: ShiftBonus): boolean {
    const clean = cleanBonus(bonus);
    if (!clean) return false;
    if (!bonuses.has(clean.id) && bonuses.size >= BONUS_MAX_PER_DATA) return false;
    transact(() => bonuses.set(clean.id, clean));
    return true;
  }

  /** Usunięcie premii; zwraca ją, żeby dało się cofnąć. */
  function deleteBonus(id: string): ShiftBonus | null {
    const prev = cleanBonus(bonuses.get(id));
    if (!prev) return null;
    transact(() => bonuses.delete(id));
    return prev;
  }

  function setMeta(key: Meta, value: number | WorkSystem | SettlementMonths | boolean): void {
    transact(() => { if (meta.get(key) !== value) meta.set(key, value); });
  }

  /** Cały Grafik naraz (przywrócenie kopii) — zastępuje, nie scala. */
  function replaceAll(data: ShiftData): void {
    transactSystem(() => {
      for (const m of [types, days, patterns, bonuses] as Y.Map<unknown>[]) for (const k of Array.from(m.keys())) m.delete(k);
      data.types.forEach((t, i) => types.set(t.id, { ...t, order: i }));
      data.patterns.forEach((p, i) => patterns.set(p.id, { ...p, order: i }));
      for (const b of data.bonuses ?? []) if (cleanBonus(b)) bonuses.set(b.id, cleanBonus(b) as ShiftBonus);
      for (const [k, e] of Object.entries(data.days)) days.set(k, e);
      meta.set("hourlyRate", data.hourlyRate);
      meta.set("nightRate", data.nightRate ?? 0);
      meta.set("workSystem", data.workSystem);
      meta.set("settlementMonths", data.settlementMonths);
      meta.set("settlementStart", data.settlementStart);
      meta.set("fte", data.fte);
      meta.set("leaveDays", data.leaveDays);
      meta.set("overtimeFrom", data.overtimeFrom);
      meta.set("sundayFrom", data.sundayFrom);
      meta.set("nightFrom", data.nightFrom);
      meta.set("typesInit", true);
      meta.set("patternsInit", true);
    });
  }

  /**
   * Dokłada dane z innego źródła (stary zapis w localStorage) bez nadpisywania
   * tego, co już jest w dokumencie — np. dni, które przyszły z drugiego telefonu.
   * Wywołana drugi raz z tym samym wejściem niczego nie zmienia.
   * `marker` ląduje w tej samej transakcji co dane: zapisują się na dysk
   * razem albo wcale, więc przerwany zapis oznacza tylko powtórkę migracji.
   */
  function mergeIn(data: ShiftData, marker?: string): void {
    transact(() => {
      if (marker) migrations.set(marker, Date.now());
      if (!meta.get("typesInit")) {
        data.types.forEach((t, i) => types.set(t.id, { ...t, order: i }));
        meta.set("typesInit", true);
      } else {
        let order = nextOrder(types);
        for (const t of data.types) if (!types.has(t.id)) types.set(t.id, { ...t, order: order++ });
      }
      if (!meta.get("patternsInit")) {
        data.patterns.forEach((p, i) => patterns.set(p.id, { ...p, order: i }));
        meta.set("patternsInit", true);
      } else {
        let order = nextOrder(patterns);
        for (const p of data.patterns) if (!patterns.has(p.id)) patterns.set(p.id, { ...p, order: order++ });
      }
      for (const [k, e] of Object.entries(data.days)) if (!days.has(k)) days.set(k, e);
      for (const b of data.bonuses ?? []) {
        const clean = cleanBonus(b);
        if (clean && !bonuses.has(clean.id) && bonuses.size < BONUS_MAX_PER_DATA) bonuses.set(clean.id, clean);
      }
      if (!meta.has("hourlyRate") && data.hourlyRate) meta.set("hourlyRate", data.hourlyRate);
      if (!meta.has("nightRate") && data.nightRate) meta.set("nightRate", data.nightRate);
      if (!meta.has("workSystem")) meta.set("workSystem", data.workSystem);
      if (!meta.has("settlementMonths") && data.settlementMonths !== 1) meta.set("settlementMonths", data.settlementMonths);
      if (!meta.has("settlementStart") && data.settlementStart !== 0) meta.set("settlementStart", data.settlementStart);
      if (!meta.has("fte") && data.fte !== 1) meta.set("fte", data.fte);
      if (!meta.has("leaveDays") && data.leaveDays !== DEFAULT_LEAVE_DAYS) meta.set("leaveDays", data.leaveDays);
      if (!meta.has("overtimeFrom") && data.overtimeFrom !== 1) meta.set("overtimeFrom", data.overtimeFrom);
      if (!meta.has("sundayFrom") && data.sundayFrom !== 6) meta.set("sundayFrom", data.sundayFrom);
      if (!meta.has("nightFrom") && data.nightFrom !== 22) meta.set("nightFrom", data.nightFrom);
    }, "shifts-migration");
  }

  const isMerged = (marker: string) => migrations.has(marker);

  return {
    get, subscribe, isMerged,
    setDayShift, setDayEntry, writeDays,
    undo: (): boolean => undoManager.undo() !== null,
    canUndo: (): boolean => undoManager.canUndo(),
    saveShiftType, deleteShiftType, restoreShiftType, addDefaultShiftTypes, addPresetOnce,
    savePattern, deletePattern, saveBonus, deleteBonus, setMeta, replaceAll, mergeIn,
  };
}

export type YShifts = ReturnType<typeof createYShifts>;
