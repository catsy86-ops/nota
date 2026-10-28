/**
 * Import zmian z pliku .ics do Grafiku (G4.5, E3). Każde VEVENT staje się dniem z jednym rodzajem
 * zmiany (wybranym przez użytkownika), a godziny bierze rodzaj. Dzień z już wpisaną zmianą zostaje
 * nietknięty. Zdarzenia cykliczne (RRULE) dają tylko pierwsze wystąpienie — reszty nie rozwijamy.
 */
import { parseIcs } from "@/lib/icsImport";
import type { DayEntry, ShiftData } from "./model";

export interface ShiftImportPlan {
  /** Dni do zapisania (`YYYY-MM-DD` → wpis). */
  changes: Record<string, DayEntry>;
  /** Ile dni dostanie zmianę. */
  imported: number;
  /** Dni, które już miały wpis albo powtarzały się w pliku. */
  skippedFilled: number;
  /** Zdarzenia cykliczne, z których wzięto tylko pierwsze wystąpienie. */
  repeating: number;
  /** Wpisy bez poprawnej daty. */
  unreadable: number;
}

const pad = (n: number) => String(n).padStart(2, "0");
/** Dzień lokalny z milisekund; całodniowe zdarzenia są już ustawione na 9:00 lokalnie (icsImport). */
export const localDayKey = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export function planShiftsFromIcs(text: string, data: Pick<ShiftData, "days">, typeId: string, now: number = Date.now()): ShiftImportPlan {
  const { events, skipped } = parseIcs(text, now, { keepPast: true });
  const changes: Record<string, DayEntry> = {};
  let skippedFilled = 0;
  let repeating = 0;
  for (const e of events) {
    const key = localDayKey(e.reminder);
    if (e.repeat !== "none") repeating += 1;
    if (data.days[key] || changes[key]) { skippedFilled += 1; continue; }
    changes[key] = { type: typeId };
  }
  return { changes, imported: Object.keys(changes).length, skippedFilled, repeating, unreadable: skipped };
}
