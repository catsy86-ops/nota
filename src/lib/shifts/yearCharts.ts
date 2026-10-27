import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { monthSummary } from "./summary";
import { dayType, type ShiftData } from "./model";
import { entryMinutesOn } from "./time";

/** Jeden miesiąc na wykresie roku (G4.3). Godziny są w godzinach dziesiętnych; zarobek w złotych. */
export interface YearChartRow {
  month: number;
  label: string;
  hours: number;
  norm: number;
  overtime: number;
  night: number;
  earnings: number;
}

/** Miesiące roku do wykresów: godziny, norma, nadgodziny, noc i zarobek. */
export function yearChartRows(data: ShiftData, year: number): YearChartRow[] {
  return Array.from({ length: 12 }, (_, month) => {
    const s = monthSummary(data, year, month);
    return {
      month,
      label: format(new Date(year, month, 1), "LLL", { locale: pl }).replace(".", ""),
      hours: s.minutes / 60,
      norm: s.normMinutes / 60,
      overtime: s.overtimeMinutes / 60,
      night: s.nightMinutes / 60,
      earnings: s.earnings,
    };
  });
}

/**
 * Minuty pracy każdego dnia roku (`dayKey` → minuty), tylko dni z pracą. Urlop i L4 nie wchodzą,
 * bo mapa pokazuje godziny, nie nieobecności.
 */
export function yearDayMinutes(data: ShiftData, year: number): Map<string, number> {
  const typesById = new Map(data.types.map((t) => [t.id, t]));
  const out = new Map<string, number>();
  for (const [key, entry] of Object.entries(data.days)) {
    if (!key.startsWith(`${year}-`)) continue;
    const base = typesById.get(entry.type);
    if (!base) continue;
    const t = dayType(base, entry);
    if (t.kind !== "work") continue;
    const minutes = entryMinutesOn(t, entry, key);
    if (minutes > 0) out.set(key, minutes);
  }
  return out;
}
