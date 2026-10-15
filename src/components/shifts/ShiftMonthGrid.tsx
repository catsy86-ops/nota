import { memo, useEffect, useMemo, useRef, useState } from "react";
import { addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { pl } from "date-fns/locale";
import { dayKey } from "@/lib/reminderOccurrences";
import { dayKeyCommand, dayType, entryMinutes, formatHoursShort, holidayName, shiftInk, shiftTextOnCard, type DayEntry, type ShiftType } from "@/lib/shifts";
import { addDaysToKey } from "@/lib/week";
import { cn } from "@/lib/utils";
import { useToday } from "@/hooks/useToday";
import { monthEnterClass, useMonthDirection } from "@/hooks/useMonthDirection";
import { stampKey, useStampedDays } from "@/hooks/useStampedDays";
import { dayCellClass, dayNumberClass, holidayDotClass, holidayNameClass, weekdayHeadClass } from "@/components/calendar/dayCellStyles";
import { DayDropCell, type DayActions } from "./ShiftDnd";
import { dayAriaLabel, dropOverClass } from "./dayLabel";

interface ShiftMonthGridProps {
  month: Date;
  days: Record<string, DayEntry>;
  typesById: Map<string, ShiftType>;
  onDay: (dayKey: string) => void;
  /** Klik w dzień spoza miesiąca albo wyjście strzałką poza miesiąc. */
  onMonthChange: (month: Date) => void;
  /** Id tekstu opisującego, co zrobi stuknięcie (wybrany pędzel). */
  describedBy?: string;
  /** Przenoszenie i kopiowanie wpisów z klawiatury (Shift+strzałki, Ctrl+C/V). */
  actions: DayActions;
}

const WEEK = { weekStartsOn: 1 } as const;

/**
 * Miesiąc w siatce 7 kolumn, od poniedziałku. Każdy dzień to przycisk —
 * stuknięcie robi to, co wybrany pędzel. Klawiatura jak w `calendar/MonthGrid`:
 * siatka to jeden przystanek tabulatora, strzałki po dniach, PageUp/PageDown
 * po miesiącach, Home/End po tygodniu; Enter/Spacja = stuknięcie.
 */
export const ShiftMonthGrid = memo(function ShiftMonthGrid({ month, days, typesById, onDay, onMonthChange, describedBy, actions }: ShiftMonthGridProps) {
  const today = useToday();
  const direction = useMonthDirection(month);
  const { stamped, cleared } = useStampedDays(`${month.getFullYear()}-${month.getMonth()}`, days, typesById);
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
    const command = dayKeyCommand(e, 7);
    if (command) {
      e.preventDefault();
      const key = dayKey(focused);
      if (command.kind === "copyEntry") actions.copyEntry(key);
      else if (command.kind === "paste") actions.paste(key);
      else {
        const target = addDaysToKey(key, command.deltaDays);
        actions.transfer(key, target, command.mode);
        // Fokus idzie za zmianą — kolejne Shift+strzałki przesuwają ją dalej.
        const [y, m, d] = target.split("-").map(Number);
        move(new Date(y, m - 1, d));
      }
      return;
    }
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
              const label = dayAriaLabel({ day, today: isToday, holiday, type, entry });

              return (
                <DayDropCell key={key} dayKey={key} draggable={!!entry}>
                  {({ dragRef, dragProps, dragging, over }) => (
                  <button
                    ref={(el) => { dragRef(el); if (el) cellRefs.current.set(key, el); else cellRefs.current.delete(key); }}
                    {...dragProps}
                    type="button"
                    tabIndex={isSameDay(day, focused) ? 0 : -1}
                    // Dzień spoza miesiąca przełącza miesiąc — malowanie go było ledwo widoczne.
                    onClick={() => { setFocused(day); if (inMonth) onDay(key); else onMonthChange(startOfMonth(day)); }}
                    aria-label={inMonth ? label : `${label} — przejdź do miesiąca`}
                    aria-current={isToday ? "date" : undefined}
                    title={holiday ?? entry?.note}
                    className={cn(
                      dayCellClass(inMonth, isToday), "w-full flex flex-col items-stretch min-h-15 sm:min-h-20 p-1",
                      inMonth && "[@media(hover:hover)]:hover:border-primary/40",
                      dragging && "opacity-40", over && dropOverClass,
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
                    {/* Wyczyszczony dzień: puste, kolorowe „odbicie” gaśnie w miejscu chipa. */}
                    {!type && cleared.has(key) && (
                      <span aria-hidden className="stamp-out absolute inset-x-1 bottom-1 h-7 sm:h-11 rounded-lg"
                        style={{ backgroundColor: cleared.get(key)!.color }} />
                    )}
                    {type && (
                      <span
                        // key: zmiana rodzaju lub godzin to nowy chip — pieczątka gra od początku.
                        key={entry ? stampKey(entry) : undefined}
                        aria-hidden
                        // Nieobecność: jasne tło w kolorze rodzaju i cienka ramka. Przerywana ramka wyglądała jak puste miejsce do wypełnienia.
                        className={cn("relative mt-auto rounded-lg px-1 py-0.5 text-center leading-tight", absence ? "border-[1.5px]" : "shadow-sm", !inMonth && "opacity-50", stamped.has(key) && "stamp-in")}
                        style={absence
                          ? { borderColor: type.color, backgroundColor: `color-mix(in srgb, ${type.color} 16%, transparent)`, color: shiftTextOnCard(type.color), "--stamp": type.color } as React.CSSProperties
                          : { backgroundColor: type.color, color: shiftInk(type.color), "--stamp": type.color } as React.CSSProperties}
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
                  )}
                </DayDropCell>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
});
