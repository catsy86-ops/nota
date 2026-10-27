import { shiftSpan } from "./time";
import type { ShiftType } from "./model";

/** Minuty od północy czasu lokalnego dla chwili `at`. */
function minutesOf(at: number): number {
  const d = new Date(at);
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Czy przypomnienie wypada w godzinach zmiany tego dnia (K3.4). Liczy się część zmiany zaczynająca się
 * tego dnia; urlop i dzień bez zmiany nie mają godzin, więc nie ma konfliktu.
 * Część nocki z poprzedniego dnia nie jest tu sprawdzana.
 */
export function atWorkingHours(at: number, shift: ShiftType | undefined): boolean {
  if (!shift || shift.kind === "absence") return false;
  const span = shiftSpan(shift);
  if (!span) return false;
  const m = minutesOf(at);
  return m >= span.from && m < span.to;
}
