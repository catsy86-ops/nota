import { memo, useEffect, useMemo, useRef, useState } from "react";
import { addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { pl } from "date-fns/locale";
import { dayKey } from "@/lib/reminderOccurrences";
import { dayType, entryMinutes, formatDuration, formatHoursShort, holidayName, shiftInk, shiftTextOnCard, type DayEntry, type ShiftType } from "@/lib/shifts";
import { cn } from "@/lib/utils";
import { monthEnterClass, useMonthDirection } from "@/hooks/useMonthDirection";
import { dayCellClass, dayNumberClass, holidayDotClass, holidayNameClass, weekdayHeadClass } from "@/components/calendar/dayCellStyles";

interface ShiftMonthGridProps {
  month: Date;
  days: Record<string, DayEntry>;
  typesById: Map<string, ShiftType>;
  onDay: (dayKey: string) => void;
  /** Klik w dzień spoza miesiąca albo wyjście strzałką poza miesiąc. */
  onMonthChange: (month: Date) => void;
  /** Id tekstu opisującego, co zrobi stuknięcie (wybrany pędzel). */
  describedBy?: string;
}

const WEEK = { weekStartsOn: 1 } as const;

/** Odświeża „dziś” po północy — PWA bywa otwarta całą noc. */
function useToday(): Date {
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => {
      const now = new Date();
      setToday((t) => (isSameDay(t, now) ? t : now));
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);
  return today;
}

/**
 * Miesiąc w siatce 7 kolumn, od poniedziałku. Każdy dzień to przycisk —
 * stuknięcie robi to, co wybrany pędzel. Klawiatura jak w `calendar/MonthGrid`:
 * siatka to jeden przystanek tabulatora, strzałki po dniach, PageUp/PageDown
 * po miesiącach, Home/End po tygodniu; Enter/Spacja = stuknięcie.
 */
export const ShiftMonthGrid = memo(function ShiftMonthGrid({ month, days, typesById, onDay, onMonthChange, describedBy }: ShiftMonthGridProps) {
  const today = useToday();
  const direction = useMonthDirection(month);
  const weeks = useMemo(() => {
    const all = eachDayOfInterval({ start: startOfWeek(month, WEEK), end: endOfWeek(endOfMonth(month), WEEK) });
    const out: Date[][] = [];
    for (let i = 0; i < all.length; i += 7) out.push(all.slice(i, i + 7));
    return out;
  }, [month]);

  // Dzień z fokusem tabulatora: dziś w bieżącym miesiącu, inaczej pierwszy dzień.
  const [focused, setFocused] = useState<Date>(() => (isSameMonth(today, month) ? today : startOfMonth(month)));
  useEffect(() => {
    setFocused((f) => (isSameMonth(f, month) ? f : isSameMonth(today, month) ? today : startOfMonth(month)));
  }, [month, today]);

  const cellRefs = useRef(new Map<string, HTMLButtonElement>());
  const shouldFocus = useRef(false);
  useEffect(() => {
    if (!shouldFocus.current) return;
    shouldFocus.current = false;
    cellRefs.current.get(dayKey(focused))?.focus();
  }, [focused, month]);

  function move(to: Date) {
    shouldFocus.current = true;
    setFocused(to);
    if (!isSameMonth(to, month)) onMonthChange(startOfMonth(to));
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const moves: Record<string, () => Date> = {
      ArrowRight: () => addDays(focused, 1),
      ArrowLeft: () => addDays(focused, -1),
      ArrowDown: () => addDays(focused, 7),
      ArrowUp: () => addDays(focused, -7),
      Home: () => startOfWeek(focused, WEEK),
      End: () => endOfWeek(focused, WEEK),
      PageUp: () => addMonths(focused, -1),
      PageDown: () => addMonths(focused, 1),
    };
    const to = moves[e.key];
    if (!to) return;
    e.preventDefault();
    move(to());
  }

  return (
    <div role="grid" aria-label={format(month, "LLLL yyyy", { locale: pl })} aria-describedby={describedBy}
      className="select-none" onKeyDown={onKeyDown}>
      <div role="row" className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-1">
        {weeks[0].map((d, i) => (
          <div key={i} role="columnheader" aria-label={format(d, "EEEE", { locale: pl })}
            className={weekdayHeadClass(i)}>
            {format(d, "EEEEEE", { locale: pl })}
          </div>
        ))}
      </div>
      {/* key = miesiąc: nowa siatka gra wejście z kierunku nawigacji. */}
      <div key={`${month.getFullYear()}-${month.getMonth()}`} className={cn("space-y-1 sm:space-y-1.5", monthEnterClass(direction))}>
        {weeks.map((week) => (
          <div key={dayKey(week[0])} role="row" className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {week.map((day) => {
              const key = dayKey(day);
              const entry = days[key];
              const base = entry && typesById.get(entry.type);
              const type = base && dayType(base, entry);
              const holiday = holidayName(key);
              const inMonth = isSameMonth(day, month);
              const isToday = isSameDay(day, today);
              const absence = type?.kind === "absence";
              const label = [
                format(day, "d MMMM", { locale: pl }),
                format(day, "EEEE", { locale: pl }),
                isToday ? "dziś" : undefined,
                holiday,
                type ? (absence ? type.name : `${type.name} ${type.start}–${type.end}`) : "wolne",
                entry?.extraMin ? `odchylenie ${formatDuration(entry.extraMin)}` : undefined,
                entry?.offSchedule ? "poza grafikiem" : undefined,
                entry?.inLieu ? "w dzień wolny za niedzielę" : undefined,
                entry?.note ? `notatka: ${entry.note}` : undefined,
              ].filter(Boolean).join(", ");

              return (
                <div key={key} role="gridcell" className="flex">
                  <button
                    ref={(el) => { if (el) cellRefs.current.set(key, el); else cellRefs.current.delete(key); }}
                    type="button"
                    tabIndex={isSameDay(day, focused) ? 0 : -1}
                    // Dzień spoza miesiąca przełącza miesiąc — malowanie go było ledwo widoczne.
                    onClick={() => { setFocused(day); if (inMonth) onDay(key); else onMonthChange(startOfMonth(day)); }}
                    aria-label={inMonth ? label : `${label} — przejdź do miesiąca`}
                    aria-current={isToday ? "date" : undefined}
                    title={holiday ?? entry?.note}
                    className={cn(
                      dayCellClass(inMonth), "w-full flex flex-col items-stretch min-h-[3.75rem] sm:min-h-[5rem] p-1",
                      inMonth && "[@media(hover:hover)]:hover:border-primary/40",
                    )}
                  >
                    <span className="flex items-center justify-between">
                      <span className={dayNumberClass({ today: isToday, holiday: !!holiday, inMonth })}>
                        {format(day, "d")}
                      </span>
                      <span className="flex gap-0.5 mr-0.5" aria-hidden>
                        {/* Na telefonie nazwa święta i godziny się nie mieszczą — zostaje znacznik, nie sam kolor. */}
                        {holiday && <span className={holidayDotClass(inMonth)} />}
                        {entry?.extraMin ? <span className="sm:hidden text-[0.5625rem] leading-none font-bold">{entry.extraMin > 0 ? "↑" : "↓"}</span> : null}
                        {entry?.note && <span className="w-1.5 h-1.5 rounded-full bg-foreground/50" />}
                      </span>
                    </span>
                    {holiday && <span aria-hidden className={holidayNameClass(inMonth)}>{holiday}</span>}
                    {type && (
                      <span
                        aria-hidden
                        // Nieobecność: jasne tło w kolorze rodzaju i cienka ramka. Przerywana ramka wyglądała jak puste miejsce do wypełnienia.
                        className={cn("mt-auto rounded-lg px-1 py-0.5 text-center leading-tight", absence ? "border-[1.5px]" : "shadow-sm", !inMonth && "opacity-50")}
                        style={absence
                          ? { borderColor: type.color, backgroundColor: `color-mix(in srgb, ${type.color} 16%, transparent)`, color: shiftTextOnCard(type.color) }
                          : { backgroundColor: type.color, color: shiftInk(type.color) }}
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
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
});
