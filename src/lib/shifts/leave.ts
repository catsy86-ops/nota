import { absenceKindOf, type AbsenceKind, type ShiftData } from "./model";
import { isNormDay } from "./holidays";
import { monthSummary } from "./summary";

const DAY_KEY = /^(\d{4})-(\d{2})-\d{2}$/;

const localKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Klucze dni z wpisem nieobecności danego rodzaju. */
function absenceDays(data: ShiftData, kind: AbsenceKind): string[] {
  const kinds = new Map(data.types.map((t) => [t.id, absenceKindOf(t)]));
  return Object.entries(data.days)
    .filter(([key, entry]) => DAY_KEY.test(key) && kinds.get(entry.type) === kind)
    .map(([key]) => key);
}

export interface LeaveBalance {
  year: number;
  /** Roczny wymiar urlopu (dni). */
  allowance: number;
  /** Dni urlopu do dziś włącznie. */
  used: number;
  /** Dni urlopu po dzisiejszym — zaplanowane. */
  planned: number;
  /** Ile zostaje po wykorzystanych i zaplanowanych; ujemne = przekroczony wymiar. */
  remaining: number;
  /**
   * Dni urlopu w sobotę, niedzielę i święto — nie liczą się do puli, tak samo
   * jak nie obniżają normy czasu pracy (art. 130 § 3 KP).
   */
  offNormDays: number;
}

/**
 * Licznik urlopu w roku kalendarzowym. Liczy tylko dni z rodzajem
 * nieobecności „urlop” (`absenceKindOf`) przypadające w dni robocze
 * (pon–pt, bez świąt) — tak jak norma miesiąca. `today` rozdziela dni
 * wykorzystane (do dziś włącznie) od zaplanowanych.
 */
export function leaveBalance(data: ShiftData, year: number, today: Date): LeaveBalance {
  const todayKey = localKey(today);
  const prefix = `${year}-`;
  let used = 0;
  let planned = 0;
  let offNormDays = 0;
  for (const key of absenceDays(data, "leave")) {
    if (!key.startsWith(prefix)) continue;
    if (!isNormDay(key)) { offNormDays += 1; continue; }
    if (key <= todayKey) used += 1;
    else planned += 1;
  }
  return { year, allowance: data.leaveDays, used, planned, remaining: data.leaveDays - used - planned, offNormDays };
}

export interface YearMonthRow {
  /** 0–11. */
  month: number;
  minutes: number;
  overtimeMinutes: number;
  nightMinutes: number;
  /** Dni urlopu w dni robocze (jak w liczniku). */
  leaveDays: number;
  /** Dni zwolnienia (L4), wszystkie kalendarzowe. */
  sickDays: number;
  earnings: number;
}

export interface YearSummary {
  year: number;
  months: YearMonthRow[];
  total: Omit<YearMonthRow, "month">;
}

/** Podsumowanie roku: wiersz na miesiąc i suma. Dzień należy do miesiąca, w którym zaczęła się zmiana. */
export function yearSummary(data: ShiftData, year: number): YearSummary {
  const leave = new Map<number, number>();
  const sick = new Map<number, number>();
  const bump = (m: Map<number, number>, key: string) => {
    if (!key.startsWith(`${year}-`)) return;
    const month = Number(key.slice(5, 7)) - 1;
    m.set(month, (m.get(month) ?? 0) + 1);
  };
  for (const key of absenceDays(data, "leave")) if (isNormDay(key)) bump(leave, key);
  for (const key of absenceDays(data, "sick")) bump(sick, key);

  const months: YearMonthRow[] = Array.from({ length: 12 }, (_, month) => {
    const s = monthSummary(data, year, month);
    return {
      month,
      minutes: s.minutes,
      overtimeMinutes: s.overtimeMinutes,
      nightMinutes: s.nightMinutes,
      leaveDays: leave.get(month) ?? 0,
      sickDays: sick.get(month) ?? 0,
      earnings: s.earnings,
    };
  });
  const total = months.reduce<Omit<YearMonthRow, "month">>(
    (acc, m) => ({
      minutes: acc.minutes + m.minutes,
      overtimeMinutes: acc.overtimeMinutes + m.overtimeMinutes,
      nightMinutes: acc.nightMinutes + m.nightMinutes,
      leaveDays: acc.leaveDays + m.leaveDays,
      sickDays: acc.sickDays + m.sickDays,
      earnings: acc.earnings + m.earnings,
    }),
    { minutes: 0, overtimeMinutes: 0, nightMinutes: 0, leaveDays: 0, sickDays: 0, earnings: 0 },
  );
  total.earnings = Math.round(total.earnings * 100) / 100;
  return { year, months, total };
}
