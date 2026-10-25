import type { ShiftData } from "@/lib/shifts/model";
import { cell } from "@/lib/shifts/timesheet";
import type { JournalEntry } from "./yStudy";
import { dayHours, type DayHours, type SiteHours } from "./siteHours";
import { dayKeyOf, workOn } from "./report";

/**
 * Godziny na budowach w miesiącu jako CSV z kosztem robocizny (2.6 planu Praca 2026-10-24).
 * Godziny dnia (z Grafiku) dzielone między budowy zasadą z `dayHours` (wpisane ręcznie albo równo),
 * koszt = godziny × stawka z Grafiku (`hourlyRate`). Dni bez zmiany pomijane.
 * Osobne wiersze: dzień i budowa, potem podsumowanie per budowa, „Bez budowy” i „Bez podziału”.
 */
export interface SiteTimesheetInput {
  shifts: ShiftData;
  sites: Readonly<Record<string, { name?: string; hours?: readonly SiteHours[] }>>;
  journal: readonly JournalEntry[];
  year: number;
  month: number;
}

const hoursText = (min: number) => (min / 60).toFixed(2).replace(".", ",");
const moneyText = (zl: number) => zl.toFixed(2).replace(".", ",");
const pad = (n: number) => String(n).padStart(2, "0");

export function buildSiteTimesheetCsv({ shifts, sites, journal, year, month }: SiteTimesheetInput): string {
  const rate = shifts.hourlyRate > 0 ? shifts.hourlyRate : 0;
  const detail: (string | number)[][] = [["Data", "Budowa", "Godziny", "Koszt (zł)"]];
  const perSite = new Map<string, { name: string; minutes: number }>();
  let restMinutes = 0;
  let undividedMinutes = 0;

  const last = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= last; d++) {
    const key = `${year}-${pad(month + 1)}-${pad(d)}`;
    const work = workOn(shifts, key);
    if (!work || work.minutes <= 0) continue;
    const day: DayHours = dayHours(journal, sites, work.minutes, key, dayKeyOf);
    let assigned = 0;
    for (const s of day.sites) {
      if (s.minutes === null) continue;
      assigned += s.minutes;
      if (s.minutes <= 0) continue;
      const cur = perSite.get(s.siteId) ?? { name: s.site, minutes: 0 };
      cur.minutes += s.minutes;
      perSite.set(s.siteId, cur);
      detail.push([key, s.site, hoursText(s.minutes), moneyText((s.minutes / 60) * rate)]);
    }
    if (day.sites.some((s) => s.minutes === null)) undividedMinutes += Math.max(0, work.minutes - assigned);
    if (day.rest > 0) restMinutes += day.rest;
  }

  const sum = [...perSite.values()].reduce((acc, s) => acc + s.minutes, 0) + restMinutes + undividedMinutes;
  const rows: (string | number)[][] = [...detail, []];
  rows.push(["Podsumowanie", "", "", ""]);
  rows.push(["Budowa", "Godziny", "Koszt (zł)", ""]);
  for (const s of [...perSite.values()].sort((a, b) => b.minutes - a.minutes)) rows.push([s.name, hoursText(s.minutes), moneyText((s.minutes / 60) * rate), ""]);
  if (restMinutes > 0) rows.push(["Bez budowy", hoursText(restMinutes), moneyText((restMinutes / 60) * rate), ""]);
  if (undividedMinutes > 0) rows.push(["Bez podziału (budowy bez godzin)", hoursText(undividedMinutes), moneyText((undividedMinutes / 60) * rate), ""]);
  rows.push(["Razem", hoursText(sum), moneyText((sum / 60) * rate), ""]);
  rows.push(["Stawka (zł/h)", rate > 0 ? moneyText(rate) : "nie ustawiona", "", ""]);
  return "\uFEFF" + rows.map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";
}
