import { dayType, isAbsence, type ShiftData } from "./model";
import { entryMinutesOn, nightMinutes } from "./time";
import { monthSummary } from "./summary";

const pad = (n: number) => String(n).padStart(2, "0");
const hours = (min: number) => (min / 60).toFixed(2).replace(".", ",");

/** Pole CSV w cudzysłowie, gdy zawiera separator, cudzysłów albo koniec linii; chroni też przed formułami arkusza. */
function cell(v: string | number): string {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s) && typeof v === "string") s = `'${s}`;
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Karta czasu miesiąca jako CSV (separator `;` i BOM — polski Excel otwiera ją od razu).
 * Dni bez wpisu są pomijane; na końcu wiersze sum z `monthSummary`.
 */
export function buildTimesheetCsv(data: ShiftData, year: number, month: number): string {
  const typesById = new Map(data.types.map((t) => [t.id, t]));
  const rows: (string | number)[][] = [["Data", "Zmiana", "Od", "Do", "Przerwa (min)", "Godziny", "Z tego noc", "Odchylenie (min)", "Notatka"]];
  const last = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= last; d++) {
    const key = `${year}-${pad(month + 1)}-${pad(d)}`;
    const entry = data.days[key];
    const base = entry && typesById.get(entry.type);
    if (!base) continue;
    const t = dayType(base, entry);
    const absence = isAbsence(t);
    rows.push([
      key,
      t.name,
      absence ? "" : t.start,
      absence ? "" : t.end,
      absence ? "" : t.breakMin,
      absence ? "" : hours(entryMinutesOn(t, entry, key)),
      absence ? "" : hours(nightMinutes(t, data.nightFrom)),
      absence ? "" : entry.extraMin ?? 0,
      entry.note ?? "",
    ]);
  }
  const s = monthSummary(data, year, month);
  rows.push([]);
  rows.push(["Przepracowane (h)", hours(s.minutes)]);
  rows.push(["Norma (h)", hours(s.normMinutes)]);
  rows.push(["Nadgodziny (h)", hours(s.overtimeMinutes)]);
  rows.push(["Z tego 100% (h)", hours(s.overtime100Minutes)]);
  rows.push(["Praca w nocy (h)", hours(s.nightMinutes)]);
  rows.push(["Dni nieobecności", s.absenceDays]);
  if (s.earnings > 0) rows.push(["Zarobek brutto (zł)", s.earnings.toFixed(2).replace(".", ",")]);
  return "\uFEFF" + rows.map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";
}
