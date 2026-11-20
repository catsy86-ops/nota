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
  for (const key of Object.keys(data.days)) {
    if (!key.startsWith(`${year}-`)) continue;
    const minutes = workMinutes(data, key, typesById);
    if (minutes > 0) out.set(key, minutes);
  }
  return out;
}

/** Minuty pracy jednego dnia (urlop, L4 i dzień bez wpisu = 0). */
function workMinutes(data: ShiftData, key: string, typesById: Map<string, ShiftData["types"][number]>): number {
  const entry = data.days[key];
  const base = entry && typesById.get(entry.type);
  if (!base) return 0;
  const t = dayType(base, entry);
  return t.kind === "work" ? entryMinutesOn(t, entry, key) : 0;
}

/** W5.3: minuty pracy pon–nd tygodnia, w którym leży `day` — do paska tygodnia na karcie Dziś. */
export function weekDayMinutes(data: ShiftData, day: Date): number[] {
  const typesById = new Map(data.types.map((t) => [t.id, t]));
  const monday = new Date(day.getFullYear(), day.getMonth(), day.getDate() - ((day.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    return workMinutes(data, format(d, "yyyy-MM-dd"), typesById);
  });
}
