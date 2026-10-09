import { memo } from "react";
import { eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfWeek } from "date-fns";
import { pl } from "date-fns/locale";
import { dayKey } from "@/lib/reminderOccurrences";
import { entryMinutes, formatDuration, formatHoursShort, holidayName, type DayEntry, type ShiftType } from "@/lib/shifts";
import { cn } from "@/lib/utils";

interface ShiftMonthGridProps {
  month: Date;
  days: Record<string, DayEntry>;
  typesById: Map<string, ShiftType>;
  onDay: (dayKey: string) => void;
}

/** Miesiąc w siatce 7 kolumn, od poniedziałku. Każdy dzień to przycisk — stuknięcie robi to, co wybrany pędzel. */
export const ShiftMonthGrid = memo(function ShiftMonthGrid({ month, days, typesById, onDay }: ShiftMonthGridProps) {
  const grid = eachDayOfInterval({
    start: startOfWeek(month, { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });
  const weekdays = grid.slice(0, 7).map((d) => format(d, "EEEEEE", { locale: pl }));
  const now = new Date();

  return (
    <div className="select-none">
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-1" aria-hidden>
        {weekdays.map((name, i) => (
          <div key={i} className={cn("text-2xs uppercase tracking-wider text-center py-1", i >= 5 ? "text-primary/80" : "text-muted-foreground")}>{name}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {grid.map((day) => {
          const key = dayKey(day);
          const entry = days[key];
          const type = entry && typesById.get(entry.type);
          const holiday = holidayName(key);
          const inMonth = isSameMonth(day, month);
          const today = isSameDay(day, now);
          const absence = type?.kind === "absence";
          const label = [
            format(day, "d MMMM", { locale: pl }),
            holiday,
            type ? (absence ? type.name : `${type.name} ${type.start}–${type.end}`) : "wolne",
            entry?.extraMin ? `odchylenie ${formatDuration(entry.extraMin)}` : undefined,
            entry?.note ? `notatka: ${entry.note}` : undefined,
          ].filter(Boolean).join(", ");

          return (
            <button
              key={key}
              type="button"
              onClick={() => onDay(key)}
              aria-label={label}
              title={holiday ?? entry?.note}
              className={cn(
                "relative flex flex-col items-stretch min-h-[3.75rem] sm:min-h-[5rem] p-1 rounded-xl border text-left transition-colors outline-none",
                "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                inMonth ? "border-border/50 bg-card/40 dark:border-transparent dark:bg-card/60 [@media(hover:hover)]:hover:border-primary/40" : "border-transparent opacity-40",
              )}
            >
              <span className="flex items-center justify-between">
                <span className={cn("text-xs font-medium tabular-nums w-5 h-5 flex items-center justify-center rounded-full",
                  today ? "bg-primary text-primary-foreground" : holiday && "text-destructive font-bold")}>
                  {format(day, "d")}
                </span>
                {entry?.note && <span aria-hidden className="w-1.5 h-1.5 mr-0.5 rounded-full bg-foreground/50" />}
              </span>
              {holiday && <span aria-hidden className="hidden sm:block text-2xs leading-tight text-destructive/80 truncate">{holiday}</span>}
              {type && (
                <span
                  aria-hidden
                  className={cn("mt-auto rounded-lg px-1 py-0.5 text-center leading-tight", absence ? "border-2 border-dashed" : "text-white shadow-sm")}
                  style={absence ? { borderColor: type.color, color: type.color } : { backgroundColor: type.color }}
                >
                  <span className="block font-display font-bold text-sm">{type.short}</span>
                  {!absence && (
                    <span className="hidden sm:block text-2xs opacity-90 tabular-nums">
                      {formatHoursShort(entryMinutes(type, entry))} h{entry?.extraMin ? (entry.extraMin > 0 ? " ↑" : " ↓") : ""}
                    </span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
});
