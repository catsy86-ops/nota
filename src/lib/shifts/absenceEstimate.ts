import { absenceKindOf, type ShiftData } from "./model";
import { monthSummary } from "./summary";

/** Zasiłek chorobowy (L4) — 80% podstawy wymiaru, domyślnie (art. 92 KP). */
export const SICK_RATE = 0.8;

const DAY_MIN = 8 * 60;
const round2 = (n: number) => Math.round(n * 100) / 100;

export interface AbsenceLine {
  days: number;
  minutes: number;
  amount: number;
}

export interface AbsenceEstimate {
  /** Średnia stawka godzinowa z trzech poprzednich miesięcy (zł/h); bez godzin — stawka z ustawień. */
  avgRate: number;
  leave: AbsenceLine;
  sick: AbsenceLine;
}

/**
 * Szacunek wynagrodzenia za urlop i L4 w miesiącu `month` (od 0). Urlop idzie wg średniej
 * godzinowej z 3 poprzednich miesięcy, L4 — 80% tej stawki. Godziny dnia: zmiana zastąpiona
 * (`plannedMin`), a dla wpisów bez niej 8 h × etat. `null`, gdy w miesiącu nie ma urlopu ani L4.
 */
export function absenceEstimate(data: ShiftData, year: number, month: number): AbsenceEstimate | null {
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
  const leaveKeys: string[] = [];
  const sickKeys: string[] = [];
  for (const [key, entry] of Object.entries(data.days)) {
    if (!key.startsWith(prefix)) continue;
    const type = data.types.find((t) => t.id === entry.type);
    const kind = type ? absenceKindOf(type) : undefined;
    if (kind === "leave") leaveKeys.push(key);
    else if (kind === "sick") sickKeys.push(key);
  }
  if (leaveKeys.length === 0 && sickKeys.length === 0) return null;

  let base = 0;
  let worked = 0;
  for (let i = 1; i <= 3; i++) {
    const d = new Date(year, month - i, 1);
    const s = monthSummary(data, d.getFullYear(), d.getMonth());
    base += s.basePay;
    worked += s.minutes;
  }
  const avgRate = worked > 0 ? base / (worked / 60) : data.hourlyRate;

  const line = (keys: string[], factor: number): AbsenceLine => {
    const minutes = keys.reduce((acc, k) => acc + (data.days[k]?.plannedMin ?? Math.round(DAY_MIN * data.fte)), 0);
    return { days: keys.length, minutes, amount: round2((minutes / 60) * avgRate * factor) };
  };
  return { avgRate: round2(avgRate), leave: line(leaveKeys, 1), sick: line(sickKeys, SICK_RATE) };
}
