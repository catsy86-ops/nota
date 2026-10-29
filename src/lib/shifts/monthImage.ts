import { formatDayKey } from "@/lib/week";
import type { ShiftData } from "./model";
import { monthSummary } from "./summary";
import { formatMoney } from "./time";

/**
 * Grafik miesiąca jako obraz do udostępnienia (PNG). Układ liczony tu jest czysty i testowalny;
 * rysowanie na canvasie i udostępnianie są w `monthImageDraw.ts` (ładowane leniwie).
 */

export interface MonthImageCell {
  /** Dzień miesiąca; `null` = pusta komórka przed pierwszym albo po ostatnim dniu. */
  day: number | null;
  /** Skrót rodzaju zmiany (np. „D”, „U”); pusty = dzień wolny albo brak wpisu. */
  label: string;
  /** Kolor rodzaju zmiany; `null` gdy brak. */
  color: string | null;
  /** Dzisiejszy dzień — obraz stawia na nim znacznik (G4.7). */
  today: boolean;
}

/** Rodzaj zmiany w legendzie obrazu: tylko te, które wystąpiły w miesiącu. */
export interface MonthImageLegendItem {
  short: string;
  name: string;
  color: string;
}

export interface MonthImageLayout {
  title: string;
  /** Nagłówki dni tygodnia, poniedziałek pierwszy. */
  weekdays: string[];
  /** Tygodnie po 7 komórek. */
  weeks: MonthImageCell[][];
  /** Wiersze podsumowania pod siatką. */
  footer: string[];
  /** Rodzaje zmian użyte w tym miesiącu, w kolejności rodzajów w grafiku. */
  legend: MonthImageLegendItem[];
}

export const WEEKDAY_SHORT = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];

/** Godziny w postaci „HH:MM” (minuty zaokrąglone w dół do pełnej minuty). */
export function formatMinutesHM(minutes: number): string {
  const m = Math.max(0, Math.floor(minutes));
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`;
}

/**
 * Układ siatki miesiąca (tydzień od poniedziałku) z rodzajami zmian i podsumowaniem.
 * `today` wyznacza znacznik „dziś”; w innym miesiącu nie ma go żadna komórka.
 */
export function monthImageLayout(data: ShiftData, year: number, month: number, today: Date = new Date()): MonthImageLayout {
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  const isThisMonth = today.getFullYear() === year && today.getMonth() === month;
  const cells: MonthImageCell[] = Array.from({ length: lead }, () => ({ day: null, label: "", color: null, today: false }));
  const usedTypes = new Set<string>();
  for (let d = 1; d <= count; d++) {
    const entry = data.days[formatDayKey(new Date(year, month, d))];
    const type = entry ? data.types.find((t) => t.id === entry.type) : undefined;
    if (type) usedTypes.add(type.id);
    cells.push({ day: d, label: type?.short ?? "", color: type?.color ?? null, today: isThisMonth && d === today.getDate() });
  }
  while (cells.length % 7) cells.push({ day: null, label: "", color: null, today: false });
  const weeks: MonthImageCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const s = monthSummary(data, year, month);
  const footer = [
    `Dni w pracy: ${s.daysWorked}`,
    `Przepracowane: ${formatMinutesHM(s.minutes)}`,
    s.absenceDays > 0 ? `Dni nieobecności: ${s.absenceDays}` : "",
    s.earnings > 0 ? `Zarobek brutto: ${formatMoney(s.earnings)}` : "",
  ].filter(Boolean);

  const legend = data.types
    .filter((t) => usedTypes.has(t.id))
    .map((t) => ({ short: t.short, name: t.name, color: t.color }));

  const monthName = new Date(year, month, 1).toLocaleDateString("pl-PL", { month: "long", year: "numeric" });
  return { title: monthName.charAt(0).toUpperCase() + monthName.slice(1), weekdays: WEEKDAY_SHORT, weeks, footer, legend };
}

/** Legenda obrazu dla kilku miesięcy: suma rodzajów bez powtórek, w kolejności pierwszego wystąpienia. */
export function mergeMonthLegend(layouts: MonthImageLayout[]): MonthImageLegendItem[] {
  const seen = new Map<string, MonthImageLegendItem>();
  for (const l of layouts) for (const item of l.legend) {
    const key = `${item.short}\u0001${item.color}`;
    if (!seen.has(key)) seen.set(key, item);
  }
  return [...seen.values()];
}
