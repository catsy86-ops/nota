import { breakOffset, shiftSpan } from "@/lib/shifts/time";
import type { ShiftType } from "@/lib/shifts/model";

/**
 * Oś godzin dnia — czysta logika (zakres godzin, paski zmiany w każdej godzinie).
 * Minuty liczone od północy dnia wybranego w kalendarzu.
 */

/** Odcinek dnia: praca albo przerwa w zmianie. */
export interface TimelinePiece {
  from: number;
  to: number;
  work: boolean;
}

const DAY_MIN = 24 * 60;

/** Domyślny zakres osi, gdy dzień nie ma ani zmiany, ani terminów poza nim. */
export const DEFAULT_HOUR_FROM = 7;
export const DEFAULT_HOUR_TO = 21;

/**
 * Odcinki zmiany: praca i przerwa (jeśli ma godzinę w zakresie zmiany).
 * Urlop/nieobecność nie ma godzin — zwraca pustą listę. Zmiana przez północ
 * kończy się o północy: część po 24:00 nie mieści się na osi tego dnia.
 */
export function shiftPieces(shift: ShiftType | undefined): TimelinePiece[] {
  if (!shift || shift.kind === "absence") return [];
  const span = shiftSpan(shift);
  if (!span) return [];
  const off = breakOffset(shift);
  if (off === null) return [{ from: span.from, to: span.to, work: true }];
  const breakFrom = span.from + off;
  const breakTo = breakFrom + shift.breakMin;
  return [
    { from: span.from, to: breakFrom, work: true },
    { from: breakFrom, to: breakTo, work: false },
    { from: breakTo, to: span.to, work: true },
  ];
}

/**
 * Część zmiany z dnia poprzedniego, która wchodzi w ten dzień po północy (K2.7): nocka 22–6 rysuje się
 * na obu dniach — 22–24 wieczorem, 0–6 rano. Minuty przesunięte do doby tego dnia.
 */
export function carryPieces(prevShift: ShiftType | undefined): TimelinePiece[] {
  return shiftPieces(prevShift)
    .filter((p) => p.to > DAY_MIN)
    .map((p) => ({ from: Math.max(0, p.from - DAY_MIN), to: p.to - DAY_MIN, work: p.work }));
}

/** Godzina HH:MM dla minut liczonych od północy (także po 24:00 — wtedy wraca na początek doby). */
export function clockOf(minutes: number): string {
  const m = ((minutes % DAY_MIN) + DAY_MIN) % DAY_MIN;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/**
 * Zakres godzin do narysowania: od `DEFAULT_HOUR_FROM` albo wcześniej, jeśli coś
 * zaczyna się przed nim; do `DEFAULT_HOUR_TO` albo dalej, jeśli coś kończy się
 * po nim. Zwraca [from, to) w pełnych godzinach, w granicach doby.
 */
export function timelineHours(pieces: TimelinePiece[], minutesOfTerms: number[]): { from: number; to: number } {
  let from = DEFAULT_HOUR_FROM;
  let to = DEFAULT_HOUR_TO;
  for (const p of pieces) {
    from = Math.min(from, Math.floor(p.from / 60));
    to = Math.max(to, Math.ceil(p.to / 60));
  }
  for (const m of minutesOfTerms) {
    from = Math.min(from, Math.floor(m / 60));
    to = Math.max(to, Math.floor(m / 60) + 1);
  }
  return { from: Math.max(0, from), to: Math.min(24, to) };
}

/**
 * Tło wiersza godziny `hour`: gradient z twardymi przejściami, który rysuje odcinki
 * zmiany tylko na tyle, na ile wchodzą w tę godzinę (np. 14:30 → połowa wiersza).
 * `undefined`, gdy w tej godzinie nic nie ma.
 */
export function hourBackground(pieces: TimelinePiece[], hour: number, color: string): string | undefined {
  const base = hour * 60;
  const parts: { a: number; b: number; css: string }[] = [];
  for (const p of pieces) {
    const a = Math.max(p.from, base) - base;
    const b = Math.min(p.to, base + 60) - base;
    if (b <= a) continue;
    const css = p.work ? color : `color-mix(in srgb, ${color} 30%, transparent)`;
    parts.push({ a, b, css });
  }
  if (!parts.length) return undefined;
  parts.sort((x, y) => x.a - y.a);
  const stops: string[] = [];
  for (const { a, b, css } of parts) {
    const pa = (a / 60) * 100;
    const pb = (b / 60) * 100;
    stops.push(`transparent ${pa}%`, `${css} ${pa}%`, `${css} ${pb}%`, `transparent ${pb}%`);
  }
  return `linear-gradient(to bottom, ${stops.join(", ")})`;
}

/** Minuty od północy czasu lokalnego (dla terminu). */
export function minutesOfDay(at: number): number {
  const d = new Date(at);
  return d.getHours() * 60 + d.getMinutes();
}
