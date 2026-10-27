import { useEffect, useMemo, useRef } from "react";
import {
  addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek,
  isSameDay, startOfMonth, startOfWeek, format,
} from "date-fns";
import { pl } from "date-fns/locale";
import { DayCell } from "./DayCell";
import { dayKey, type Occurrence } from "@/lib/reminderOccurrences";
import { monthEnterClass, useMonthDirection } from "@/hooks/useMonthDirection";
import { cn } from "@/lib/utils";
import type { ShiftType } from "@/lib/shifts";
import type { StudyDayMarks } from "@/lib/study/calendarMarks";
import { weekdayHeadClass } from "./dayCellStyles";

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

/** Stała zamiast `?? []`: nowa pusta tablica przy każdym renderze psuje `memo(DayCell)`. */
const NO_OCCURRENCES: Occurrence[] = [];

interface MonthGridProps {
  month: Date;
  byDay: Map<string, Occurrence[]>;
  titleOf: (noteId: string) => string;
  /** Zmiana z Grafiku w dniu (klucz `yyyy-MM-dd`). */
  shiftOf?: (key: string) => ShiftType | undefined;
  /** Wizyty serwisowe i dostawy z Pracy w dniu (tylko odczyt). */
  studyOf?: (key: string) => StudyDayMarks | undefined;
  /** Klawisz Z na dniu: edycja zmiany z Grafiku. */
  onEditShift?: (day: Date) => void;
  selectedDay: Date;
  onSelectDay: (day: Date) => void;
  /** Enter/Spacja na dniu — klawiaturowy odpowiednik „dodaj termin”. */
  onActivateDay: (day: Date) => void;
  /** Wyjście strzałką poza miesiąc przewija kalendarz, zamiast blokować ruch. */
  onMonthChange: (month: Date) => void;
  /** Warstwa „Święta” (K3.3). */
  showHolidays?: boolean;
}

export function MonthGrid({ month, byDay, titleOf, shiftOf, studyOf, selectedDay, onSelectDay, onActivateDay, onEditShift, onMonthChange, showHolidays = true }: MonthGridProps) {
  const cellRefs = useRef(new Map<string, HTMLDivElement>());
  // Ta sama funkcja dla tego samego dnia: nowa przy każdym renderze unieważniałaby `memo(DayCell)`.
  const cellRefFor = useMemo(() => {
    const callbacks = new Map<string, (el: HTMLDivElement | null) => void>();
    return (key: string) => {
      let ref = callbacks.get(key);
      if (!ref) {
        ref = (el) => {
          if (el) cellRefs.current.set(key, el);
          else cellRefs.current.delete(key);
        };
        callbacks.set(key, ref);
      }
      return ref;
    };
  }, []);
  // Fokus przenosimy dopiero po tym, jak użytkownik ruszył klawiaturą —
  // inaczej samo wejście w widok przeskakiwałoby stronę do siatki.
  const shouldFocus = useRef(false);
  const direction = useMonthDirection(month);

  // Tygodnie liczone raz na miesiąc: te same obiekty `Date` między renderami, żeby `memo(DayCell)` działał.
  const weeks = useMemo(() => {
    const days = eachDayOfInterval({
      start: startOfWeek(startOfMonth(month), { weekStartsOn: WEEK_STARTS_ON }),
      end: endOfWeek(endOfMonth(month), { weekStartsOn: WEEK_STARTS_ON }),
    });
    const rows: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
    return rows;
  }, [month]);

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
      case "z":
      case "Z":
        // Skrót „zmiana”: godziny i rodzaj zmiany wybranego dnia (bez modyfikatorów, by nie zabierać Ctrl+Z).
        if (!onEditShift || e.ctrlKey || e.metaKey || e.altKey) return;
        onEditShift(selectedDay);
        break;
      // K2.5: skróty bez modyfikatorów (jak w Google Calendar). N/P to następny i poprzedni miesiąc, C — nowy termin.
      case "t":
      case "T": {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        move(today);
        break;
      }
      case "n":
      case "N":
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        move(addMonths(selectedDay, 1));
        break;
      case "p":
      case "P":
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        move(addMonths(selectedDay, -1));
        break;
      case "c":
      case "C":
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        onActivateDay(selectedDay);
        break;
      default: return;
    }
    e.preventDefault();
  }

  const weekdays = weeks[0].map((d) => format(d, "EEEEEE", { locale: pl }));
  // Czytnik ekranu literowałby „pn”, „wt” — nagłówki dostają pełne nazwy.
  const fullWeekdays = weeks[0].map((d) => format(d, "EEEE", { locale: pl }));

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
            aria-label={fullWeekdays[i]}
            className={weekdayHeadClass(i)}
          >
            {name}
          </div>
        ))}
      </div>

      {/* key = miesiąc: nowa siatka gra wejście z kierunku nawigacji. */}
      <div key={`${month.getFullYear()}-${month.getMonth()}`} className={cn("flex flex-col gap-1 sm:gap-1.5", monthEnterClass(direction))}>
        {weeks.map((week) => (
          <div key={dayKey(week[0])} role="row" className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {week.map((day) => {
              const key = dayKey(day);
              return (
                <DayCell
                  key={key}
                  showHolidays={showHolidays}
                  day={day}
                  month={month}
                  occurrences={byDay.get(key) ?? NO_OCCURRENCES}
                  titleOf={titleOf}
                  shift={shiftOf?.(key)}
                  study={studyOf?.(key)}
                  selected={isSameDay(day, selectedDay)}
                  focused={isSameDay(day, selectedDay)}
                  onSelect={onSelectDay}
                  onActivate={onActivateDay}
                  cellRef={cellRefFor(key)}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
