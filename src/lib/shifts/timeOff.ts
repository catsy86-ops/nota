import { settlementPeriod, monthSummary } from "./summary";
import type { ShiftData } from "./model";

export interface TimeOffBalance {
  /** Nadgodziny wypracowane w okresie rozliczeniowym (minuty). */
  owedMin: number;
  /** Odebrane wolne przeliczone na nadgodziny (minuty): godziny ÷ przelicznik. */
  takenMin: number;
  /** Zostaje do odbioru; ujemne = odebrano więcej, niż wypracowano. */
  remainingMin: number;
}

const DAY_MIN = 8 * 60;

/**
 * Saldo odbioru nadgodzin w okresie rozliczeniowym miesiąca `month` (od 0), art. 151² KP.
 * Dzień z `timeOff` na nieobecności odbiera godziny swojej zmiany (`plannedMin`, a bez tego
 * 8 h × etat), przeliczone przez `timeOff`: 1 = 1:1, 1,5 = 1:1,5. Nadgodziny w okresie to
 * `overtimeMinutes` z podsumowań miesięcy okresu.
 */
export function timeOffBalance(data: ShiftData, year: number, month: number): TimeOffBalance {
  const p = settlementPeriod(year, month, data.settlementMonths, data.settlementStart);
  const prefixes: string[] = [];
  let owed = 0;
  for (let i = 0; i < p.months; i++) {
    const abs = p.year * 12 + p.startMonth + i;
    const y = Math.floor(abs / 12);
    const mo = abs % 12;
    owed += monthSummary(data, y, mo).overtimeMinutes;
    prefixes.push(`${y}-${String(mo + 1).padStart(2, "0")}-`);
  }
  let taken = 0;
  for (const [key, entry] of Object.entries(data.days)) {
    if (!entry.timeOff || !prefixes.some((pre) => key.startsWith(pre))) continue;
    const type = data.types.find((t) => t.id === entry.type);
    if (!type || type.kind !== "absence") continue;
    taken += (entry.plannedMin ?? Math.round(DAY_MIN * data.fte)) / entry.timeOff;
  }
  const takenMin = Math.round(taken);
  return { owedMin: owed, takenMin, remainingMin: Math.round(owed) - takenMin };
}
