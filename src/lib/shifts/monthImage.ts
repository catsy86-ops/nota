import { formatDayKey } from "@/lib/week";
import type { ShiftData } from "./model";
import { monthSummary } from "./summary";

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
}

export interface MonthImageLayout {
  title: string;
  /** Nagłówki dni tygodnia, poniedziałek pierwszy. */
  weekdays: string[];
  /** Tygodnie po 7 komórek. */
  weeks: MonthImageCell[][];
  /** Wiersze podsumowania pod siatką. */
  footer: string[];
}

export const WEEKDAY_SHORT = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];

/** Godziny w postaci „HH:MM” (minuty zaokrąglone w dół do pełnej minuty). */
export function formatMinutesHM(minutes: number): string {
  const m = Math.max(0, Math.floor(minutes));
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`;
}

/** Układ siatki miesiąca (tydzień od poniedziałku) z rodzajami zmian i podsumowaniem. */
export function monthImageLayout(data: ShiftData, year: number, month: number): MonthImageLayout {
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  const cells: MonthImageCell[] = Array.from({ length: lead }, () => ({ day: null, label: "", color: null }));
  for (let d = 1; d <= count; d++) {
    const entry = data.days[formatDayKey(new Date(year, month, d))];
    const type = entry ? data.types.find((t) => t.id === entry.type) : undefined;
    cells.push({ day: d, label: type?.short ?? "", color: type?.color ?? null });
  }
  while (cells.length % 7) cells.push({ day: null, label: "", color: null });
  const weeks: MonthImageCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const s = monthSummary(data, year, month);
  const footer = [
    `Dni w pracy: ${s.daysWorked}`,
    `Przepracowane: ${formatMinutesHM(s.minutes)}`,
    s.absenceDays > 0 ? `Dni nieobecności: ${s.absenceDays}` : "",
    s.earnings > 0 ? `Zarobek brutto: ${s.earnings.toFixed(2)} zł` : "",
  ].filter(Boolean);

  const monthName = new Date(year, month, 1).toLocaleDateString("pl-PL", { month: "long", year: "numeric" });
  return { title: monthName.charAt(0).toUpperCase() + monthName.slice(1), weekdays: WEEKDAY_SHORT, weeks, footer };
}
