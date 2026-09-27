import { useEffect, useRef } from "react";
import {
  addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek,
  isSameDay, startOfMonth, startOfWeek, format,
} from "date-fns";
import { pl } from "date-fns/locale";
import { DayCell } from "./DayCell";
import { dayKey, type Occurrence } from "@/lib/reminderOccurrences";

/**
 * Siatka miesiąca — własna, nie `react-day-picker`.
 *
 * Komórka day-pickera to sztywny `h-9 w-9` `<button>`, więc chipy z terminami
 * byłyby klikalnymi elementami wewnątrz przycisku: niepoprawny HTML i zepsuta
 * obsługa klawiaturą. Własna siatka daje też miejsce na `useDroppable`
 * w etapie przeciągania terminów. `ui/calendar.tsx` zostaje nietknięte i
 * dalej obsługuje pickery przypomnień.
 *
 * Obsługa klawiaturą jest tym, co przy własnej siatce trzeba odtworzyć
 * świadomie: roving tabindex (siatka to jeden przystanek tabulatora),
 * strzałki po dniach, PageUp/PageDown po miesiącach, Home/End po tygodniu.
 */

/** Tydzień zaczyna się w poniedziałek — aplikacja jest polska. */
const WEEK_STARTS_ON = 1 as const;

interface MonthGridProps {
  month: Date;
  byDay: Map<string, Occurrence[]>;
  titleOf: (noteId: string) => string;
  selectedDay: Date;
  onSelectDay: (day: Date) => void;
  /** Enter/Spacja na dniu — klawiaturowy odpowiednik „dodaj termin”. */
  onActivateDay: (day: Date) => void;
  /** Wyjście strzałką poza miesiąc przewija kalendarz, zamiast blokować ruch. */
  onMonthChange: (month: Date) => void;
}

export function MonthGrid({ month, byDay, titleOf, selectedDay, onSelectDay, onActivateDay, onMonthChange }: MonthGridProps) {
  const cellRefs = useRef(new Map<string, HTMLDivElement>());
  // Fokus przenosimy dopiero po tym, jak użytkownik ruszył klawiaturą —
  // inaczej samo wejście w widok przeskakiwałoby stronę do siatki.
  const shouldFocus = useRef(false);

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: WEEK_STARTS_ON }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: WEEK_STARTS_ON }),
  });

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  useEffect(() => {
    if (!shouldFocus.current) return;
    shouldFocus.current = false;
    cellRefs.current.get(dayKey(selectedDay))?.focus();
  }, [selectedDay, month]);

  function move(to: Date) {
    shouldFocus.current = true;
    onSelectDay(to);
    if (to.getMonth() !== month.getMonth() || to.getFullYear() !== month.getFullYear()) {
      onMonthChange(new Date(to.getFullYear(), to.getMonth(), 1));
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    switch (e.key) {
      case "ArrowRight": move(addDays(selectedDay, 1)); break;
      case "ArrowLeft": move(addDays(selectedDay, -1)); break;
      case "ArrowDown": move(addDays(selectedDay, 7)); break;
      case "ArrowUp": move(addDays(selectedDay, -7)); break;
      case "Home": move(startOfWeek(selectedDay, { weekStartsOn: WEEK_STARTS_ON })); break;
      case "End": move(endOfWeek(selectedDay, { weekStartsOn: WEEK_STARTS_ON })); break;
      case "PageUp": move(addMonths(selectedDay, -1)); break;
      case "PageDown": move(addMonths(selectedDay, 1)); break;
      case "Enter":
      case " ":
        onActivateDay(selectedDay);
        break;
      default: return;
    }
    e.preventDefault();
  }

  const weekdays = weeks[0].map((d) => format(d, "EEEEEE", { locale: pl }));

  return (
    <div
      role="grid"
      aria-label={`Kalendarz przypomnień, ${format(month, "LLLL yyyy", { locale: pl })}`}
      onKeyDown={onKeyDown}
      className="select-none"
    >
      <div role="row" className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-1">
        {weekdays.map((name, i) => (
          <div
            key={i}
            role="columnheader"
            className="text-[10px] uppercase tracking-wider text-muted-foreground text-center py-1"
          >
            {name}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1 sm:gap-1.5">
        {weeks.map((week) => (
          <div key={dayKey(week[0])} role="row" className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {week.map((day) => {
              const key = dayKey(day);
              return (
                <DayCell
                  key={key}
                  day={day}
                  month={month}
                  occurrences={byDay.get(key) ?? []}
                  titleOf={titleOf}
                  selected={isSameDay(day, selectedDay)}
                  focused={isSameDay(day, selectedDay)}
                  onSelect={onSelectDay}
                  cellRef={(el) => {
                    if (el) cellRefs.current.set(key, el);
                    else cellRefs.current.delete(key);
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
