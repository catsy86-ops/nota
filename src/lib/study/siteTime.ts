import { cell } from "@/lib/shifts/timesheet";

/**
 * P2.8 Czas na budowie: licznik od „Wchodzę” (karta kontrolna) i miesięczne zestawienie godzin
 * ze stawką budowy do rozliczenia. Czysta logika; godziny dni liczy `siteMinutesByDay`.
 */

/** Minuty od wejścia do teraz; `null`, gdy nie weszło albo już wyszło. */
export function liveMinutes(record: { at?: number; leftAt?: number } | undefined, now: number): number | null {
  if (!record?.at || record.leftAt) return null;
  return Math.max(0, Math.floor((now - record.at) / 60_000));
}

/** „2 h 05 min” albo „45 min”. */
export function durationLabel(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
}

const num = (n: number) => n.toFixed(2).replace(".", ",");

export interface MonthHours {
  minutes: number;
  /** Dni z kilkoma budowami bez podziału — bez godzin w zestawieniu. */
  unsplit: number;
  /** Kwota (zł) przy stawce; `null` bez stawki. */
  amount: number | null;
}

export function monthHours(days: readonly { minutes: number | null }[], rate: number | undefined): MonthHours {
  let minutes = 0, unsplit = 0;
  for (const d of days) { if (d.minutes === null) unsplit++; else minutes += d.minutes; }
  return { minutes, unsplit, amount: rate ? Math.round((minutes / 60) * rate * 100) / 100 : null };
}

/** CSV miesiąca (separator `;`, BOM): dzień, godziny, stawka, kwota; na końcu suma. */
export function siteMonthCsv(days: readonly { day: string; minutes: number | null }[], rate: number | undefined): string {
  const rows: (string | number)[][] = [["Data", "Godziny", "Stawka (zł/h)", "Kwota (zł)", "Uwagi"]];
  for (const d of days) {
    if (d.minutes === null) { rows.push([d.day, "", "", "", "kilka budów bez podziału godzin"]); continue; }
    const h = d.minutes / 60;
    rows.push([d.day, num(h), rate ? num(rate) : "", rate ? num(h * rate) : "", ""]);
  }
  const sum = monthHours(days, rate);
  rows.push([]);
  rows.push(["Razem", num(sum.minutes / 60), rate ? num(rate) : "", sum.amount !== null ? num(sum.amount) : "", sum.unsplit ? `dni bez podziału: ${sum.unsplit}` : ""]);
  return "\uFEFF" + rows.map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";
}
