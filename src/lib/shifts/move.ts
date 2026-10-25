import type { DayEntry } from "./model";
import { addDaysToKey, weekKeys } from "../week";
import { dayDiff } from "./pattern";

/** Przeniesienie zabiera zmianę z dnia źródłowego, kopia ją zostawia. */
export type TransferMode = "move" | "copy";

/**
 * Wpis przeniesiony na inny dzień: rodzaj, notatka i odchylenie. Znaczniki
 * `offSchedule` i `inLieu` opisują konkretny dzień (niedziela, święto, dzień
 * wolny za niedzielę), więc nie jadą razem z wpisem. Godziny sprzed zmiany
 * rodzaju (`hours`) zostają tylko, gdy dzień docelowy jest w przeszłości —
 * przyszły dzień ma liczyć się wg bieżących godzin rodzaju. Godziny wpisane
 * ręcznie (`customHours`) jadą zawsze.
 */
export function transferredEntry(entry: DayEntry, targetKey: string, todayKey: string): DayEntry {
  const out: DayEntry = { type: entry.type };
  if (entry.note) out.note = entry.note;
  if (entry.extraMin) out.extraMin = entry.extraMin;
  if (entry.hours && (entry.customHours || targetKey < todayKey)) out.hours = entry.hours;
  if (entry.hours && entry.customHours) out.customHours = true;
  return out;
}

const same = (a: DayEntry | undefined, b: DayEntry): boolean =>
  !!a && a.type === b.type && (a.note ?? "") === (b.note ?? "") && (a.extraMin ?? 0) === (b.extraMin ?? 0)
  && !a.offSchedule && !a.inLieu && JSON.stringify(a.hours ?? null) === JSON.stringify(b.hours ?? null) && !!a.customHours === !!b.customHours;

/**
 * Zmiany dni do zapisu przy przeniesieniu/skopiowaniu wpisu z `from` na `to`
 * (`null` = wyczyść dzień), albo `null`, gdy nie ma czego robić: ten sam dzień,
 * pusty dzień źródłowy albo kopia na dzień z identycznym wpisem.
 */
export function planTransfer(
  days: Record<string, DayEntry>,
  from: string,
  to: string,
  mode: TransferMode,
  todayKey: string,
): Record<string, DayEntry | null> | null {
  const source = days[from];
  if (!source || from === to) return null;
  const moved = transferredEntry(source, to, todayKey);
  if (mode === "copy" && same(days[to], moved)) return null;
  return mode === "move" ? { [from]: null, [to]: moved } : { [to]: moved };
}

/** Wklejenie wpisu ze schowka na dzień `to`; `null`, gdy dzień ma już identyczny wpis. */
export function planPaste(
  days: Record<string, DayEntry>,
  entry: DayEntry,
  to: string,
  todayKey: string,
): Record<string, DayEntry> | null {
  const next = transferredEntry(entry, to, todayKey);
  return same(days[to], next) ? null : { [to]: next };
}

export interface WeekCopyPlan {
  /** Dni do zapisu. */
  changes: Record<string, DayEntry>;
  /** Ile dni dostanie wpis. */
  copied: number;
  /** Z nich: ile ma już inny wpis, który zostanie zastąpiony. */
  overwritten: number;
}

/**
 * Kopiuje tydzień z dniem `weekOf` o `offsetDays` dni dalej (domyślnie na
 * następny). Dzień pusty w źródle niczego w celu nie czyści — kopiowanie
 * dokłada wpisy, a nie wymazuje tego, co ktoś już zaplanował.
 */
/**
 * Zamiana dwóch dni jednym zapisem: wpis z `from` ląduje na `to` i odwrotnie. Zwraca `null`,
 * gdy któryś dzień jest pusty albo to ten sam dzień.
 */
export function planSwap(days: Record<string, DayEntry>, from: string, to: string, todayKey: string): WeekCopyPlan | null {
  const a = days[from];
  const b = days[to];
  if (!a || !b || from === to) return null;
  const changes: Record<string, DayEntry> = {
    [to]: transferredEntry(a, to, todayKey),
    [from]: transferredEntry(b, from, todayKey),
  };
  return { changes, copied: 2, overwritten: 2 };
}

/**
 * Kopia miesiąca `fromMonth` na `toMonth` (`RRRR-MM`) po dniach tygodnia: pn → pn, z tym samym
 * rzędem tygodnia (przesunięcie o wielokrotność 7 dni). Dzień bez pary w miesiącu docelowym się
 * pomija, a kopia nie nadpisuje dni, które już mają wpis.
 */
export function planMonthCopy(days: Record<string, DayEntry>, fromMonth: string, toMonth: string, todayKey: string): WeekCopyPlan {
  const changes: Record<string, DayEntry> = {};
  let overwritten = 0;
  // Przesunięcie o najbliższą wielokrotność 7 dni między pierwszymi dniami miesięcy.
  const monthGap = dayDiff(`${fromMonth}-01`, `${toMonth}-01`);
  const shift = Math.round(monthGap / 7) * 7;
  for (const [src, entry] of Object.entries(days)) {
    if (!src.startsWith(fromMonth)) continue;
    // Trzy kandydaty o tym samym dniu tygodnia; ten, który trafia w miesiąc docelowy.
    const dst = [shift - 7, shift, shift + 7].map((off) => addDaysToKey(src, off)).find((k) => k.startsWith(toMonth));
    if (!dst) continue;
    const next = transferredEntry(entry, dst, todayKey);
    const existing = days[dst];
    if (same(existing, next)) continue;
    if (existing) overwritten++;
    changes[dst] = next;
  }
  return { changes, copied: Object.keys(changes).length, overwritten };
}

/**
 * Kopia zakresu dni `fromKey`…`toKey` (włącznie) na początek `targetKey` — przesunięcie o różnicę
 * początków. Nie nadpisuje po cichu: liczy dni, które już mają wpis (`overwritten`).
 */
export function planRangeCopy(days: Record<string, DayEntry>, fromKey: string, toKey: string, targetKey: string, todayKey: string): WeekCopyPlan {
  const changes: Record<string, DayEntry> = {};
  let overwritten = 0;
  const offset = dayDiff(fromKey, targetKey);
  for (const [src, entry] of Object.entries(days)) {
    if (src < fromKey || src > toKey) continue;
    const dst = addDaysToKey(src, offset);
    const next = transferredEntry(entry, dst, todayKey);
    const existing = days[dst];
    if (same(existing, next)) continue;
    if (existing) overwritten++;
    changes[dst] = next;
  }
  return { changes, copied: Object.keys(changes).length, overwritten };
}

export function planWeekCopy(
  days: Record<string, DayEntry>,
  weekOf: string,
  todayKey: string,
  offsetDays = 7,
): WeekCopyPlan {
  const changes: Record<string, DayEntry> = {};
  let overwritten = 0;
  for (const src of weekKeys(weekOf)) {
    const entry = days[src];
    if (!entry) continue;
    const dst = addDaysToKey(src, offsetDays);
    const next = transferredEntry(entry, dst, todayKey);
    const existing = days[dst];
    if (same(existing, next)) continue;
    if (existing) overwritten++;
    changes[dst] = next;
  }
  return { changes, copied: Object.keys(changes).length, overwritten };
}

/** Klawisz na dniu w siatce — co robi (czysta funkcja: testowalna bez DOM). */
export type DayKeyCommand =
  | { kind: "transfer"; deltaDays: number; mode: TransferMode }
  | { kind: "copyEntry" }
  | { kind: "paste" };

interface KeyLike { key: string; shiftKey: boolean; altKey: boolean; ctrlKey: boolean; metaKey: boolean }

/**
 * Odpowiednik przeciągania z klawiatury (WCAG 2.5.7): Shift+strzałka przenosi
 * zmianę o dzień (±1 w poziomie, `vertical` w pionie), Alt+Shift+strzałka ją
 * kopiuje; Ctrl/⌘+C bierze wpis dnia do schowka, Ctrl/⌘+V go wkleja.
 */
export function dayKeyCommand(e: KeyLike, vertical: number): DayKeyCommand | null {
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
    const k = e.key.toLowerCase();
    if (k === "c") return { kind: "copyEntry" };
    if (k === "v") return { kind: "paste" };
    return null;
  }
  if (!e.shiftKey || e.ctrlKey || e.metaKey) return null;
  const deltas: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -vertical, ArrowDown: vertical };
  const deltaDays = deltas[e.key];
  if (!deltaDays) return null;
  return { kind: "transfer", deltaDays, mode: e.altKey ? "copy" : "move" };
}
