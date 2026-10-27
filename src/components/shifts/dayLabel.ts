import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { formatDuration, shiftLabel, type DayEntry, type ShiftType } from "@/lib/shifts";

/** Czytany opis dnia w siatce miesiąca i w widoku tygodnia (to samo brzmienie, żeby nawyki czytnika ekranu się zgadzały). */
export function dayAriaLabel(opts: { day: Date; today: boolean; holiday?: string; type?: ShiftType; entry?: DayEntry; extra?: string[] }): string {
  const { day, today, holiday, type, entry, extra = [] } = opts;
  return [
    format(day, "d MMMM", { locale: pl }),
    format(day, "EEEE", { locale: pl }),
    today ? "dziś" : undefined,
    holiday,
    type ? shiftLabel(type) : "wolne",
    entry?.extraMin ? `odchylenie ${formatDuration(entry.extraMin)}` : undefined,
    entry?.offSchedule ? "poza grafikiem" : undefined,
    entry?.inLieu ? "w dzień wolny za niedzielę" : undefined,
    entry?.note ? `notatka: ${entry.note}` : undefined,
    ...extra,
  ].filter(Boolean).join(", ");
}

/** Cel upuszczenia zmiany — to samo podświetlenie co w kalendarzu przypomnień. */
export const dropOverClass =
  "border-primary! bg-[color-mix(in_srgb,var(--primary)_12%,var(--card))] shadow-[0_0_0_3px_color-mix(in srgb, var(--primary) 14%, transparent)]";
