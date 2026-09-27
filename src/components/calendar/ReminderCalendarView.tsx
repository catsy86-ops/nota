import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, isSameMonth } from "date-fns";
import { pl } from "date-fns/locale";
import { expandOccurrences, groupByDay, dayKey } from "@/lib/reminderOccurrences";
import { MonthGrid } from "./MonthGrid";
import { DayPanel } from "./DayPanel";
import type { Note } from "@/hooks/useNotes";

/**
 * Widok kalendarza przypomnień: siatka miesiąca + lista terminów wybranego dnia.
 *
 * Etap 3 jest celowo tylko do czytania — dodawanie, edycja i usuwanie terminów
 * dochodzą w kolejnych krokach. Wystąpienia liczy `expandOccurrences`, więc
 * serie są prognozą rysowaną w locie, nie danymi.
 */

interface ReminderCalendarViewProps {
  /** Notatki z terminami — bez kosza, tak samo jak karmione są powiadomienia. */
  notes: Note[];
}

function monthBounds(month: Date) {
  return {
    start: new Date(month.getFullYear(), month.getMonth(), 1, 0, 0, 0, 0).getTime(),
    end: new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999).getTime(),
  };
}

export function ReminderCalendarView({ notes }: ReminderCalendarViewProps) {
  const [month, setMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => new Date());

  // Siatka pokazuje też dni sąsiednich miesięcy, więc zakres jest o tydzień
  // szerszy z każdej strony — inaczej skrajne komórki byłyby zawsze puste.
  const { start, end } = useMemo(() => monthBounds(month), [month]);
  const WEEK = 7 * 24 * 3600_000;
  const byDay = useMemo(
    () => groupByDay(expandOccurrences(notes, start - WEEK, end + WEEK)),
    [notes, start, end, WEEK],
  );

  const titleOf = useMemo(() => {
    const titles = new Map(notes.map((n) => [n.id, n.title || n.content.slice(0, 40)]));
    return (id: string) => titles.get(id) ?? "";
  }, [notes]);

  const shiftMonth = (delta: number) =>
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));

  function goToToday() {
    const today = new Date();
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDay(today);
  }

  const isThisMonth = isSameMonth(month, new Date());
  const selectedOccurrences = byDay.get(dayKey(selectedDay)) ?? [];

  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <header className="flex items-center gap-2">
        <button
          onClick={() => shiftMonth(-1)}
          aria-label="Poprzedni miesiąc"
          className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h2 aria-live="polite" className="font-display font-bold text-lg capitalize min-w-[11ch] text-center">
          {format(month, "LLLL yyyy", { locale: pl })}
        </h2>
        <button
          onClick={() => shiftMonth(1)}
          aria-label="Następny miesiąc"
          className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        {!isThisMonth && (
          <button
            onClick={goToToday}
            aria-label="Wróć do bieżącego miesiąca"
            className="ml-1 text-xs font-medium text-primary hover:bg-primary/10 px-2.5 py-1 rounded-lg transition-colors"
          >
            Dziś
          </button>
        )}
        <p className="ml-auto text-[11px] text-muted-foreground hidden sm:block">
          ↑↓←→ — dni · PgUp/PgDn — miesiąc
        </p>
      </header>

      <MonthGrid
        month={month}
        byDay={byDay}
        titleOf={titleOf}
        selectedDay={selectedDay}
        onSelectDay={setSelectedDay}
        onMonthChange={setMonth}
      />

      <DayPanel day={selectedDay} occurrences={selectedOccurrences} titleOf={titleOf} />
    </motion.section>
  );
}
