import { addDays } from "date-fns";
import { dayType, type DayEntry, type ShiftType } from "./model";

/**
 * Wieczorne przypomnienie o jutrzejszej zmianie. Ustawienie jest na urządzeniu
 * (localStorage), nie w dokumencie Yjs: godzina przypomnienia jest sprawą
 * telefonu, a nie grafiku, i nie ma sensu, żeby drugie urządzenie odpalało to samo.
 */
export const EVENING_NUDGE_KEY = "kaczy:shifts.eveningNudge";
/** Dzień (`yyyy-MM-dd`), o którym już przypomniano — raz na jutrzejszy dzień. */
export const EVENING_NUDGED_KEY = "kaczy:shifts.eveningNudged";

export const EVENING_NUDGE_HOURS = [18, 19, 20, 21, 22] as const;

const TIME = /^(\d{1,2}):(\d{2})$/;

const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Zmiana jako tekst: nazwa nieobecności albo nazwa z godzinami. */
export function shiftLabel(shift: Pick<ShiftType, "kind" | "name" | "start" | "end">): string {
  return shift.kind === "absence" ? shift.name : `${shift.name} ${shift.start}–${shift.end}`;
}

export function readEveningNudgeTime(): string | null {
  try {
    const v = localStorage.getItem(EVENING_NUDGE_KEY);
    return v && TIME.test(v) ? v : null;
  } catch { return null; }
}

export function writeEveningNudgeTime(time: string | null): void {
  try {
    if (time) localStorage.setItem(EVENING_NUDGE_KEY, time);
    else localStorage.removeItem(EVENING_NUDGE_KEY);
  } catch { /* brak localStorage — ustawienie nie przetrwa, nic więcej */ }
}

export interface EveningNudge {
  /** Dzień, którego dotyczy przypomnienie (`yyyy-MM-dd`). */
  forKey: string;
  title: string;
  description?: string;
}

/**
 * Czy właśnie teraz należy przypomnieć o jutrzejszej zmianie. Zwraca treść albo
 * `null`: wyłączone, jeszcze przed godziną, już przypomniane albo jutro bez zmiany.
 */
export function eveningNudgeFor(
  now: Date,
  time: string | null,
  lastNudgedFor: string | null,
  days: Record<string, DayEntry>,
  typesById: Map<string, ShiftType>,
): EveningNudge | null {
  const m = time ? TIME.exec(time) : null;
  if (!m) return null;
  if (now.getHours() * 60 + now.getMinutes() < Number(m[1]) * 60 + Number(m[2])) return null;

  const forKey = keyOf(addDays(now, 1));
  if (lastNudgedFor === forKey) return null;

  const entry = days[forKey];
  const base = entry && typesById.get(entry.type);
  if (!base) return null;
  const type = dayType(base, entry);
  return {
    forKey,
    title: `Jutro: ${shiftLabel(type)}`,
    description: entry.note || undefined,
  };
}
