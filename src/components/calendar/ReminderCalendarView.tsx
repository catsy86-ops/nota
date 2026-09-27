import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { expandOccurrences, groupByDay, dayKey } from "@/lib/reminderOccurrences";
import type { Note } from "@/hooks/useNotes";

/**
 * Widok kalendarza przypomnień.
 *
 * Etap 2: nawigacja po miesiącach i policzone wystąpienia. Siatka miesiąca,
 * chipy i dodawanie/edycja dochodzą w etapach 3–5 — do tego czasu widok
 * uczciwie mówi, ile terminów zna, zamiast udawać gotowy kalendarz.
 */

interface ReminderCalendarViewProps {
  /** Notatki z terminami — bez kosza, tak samo jak karmione są powiadomienia. */
  notes: Note[];
}

function monthBounds(month: Date) {
  const start = new Date(month.getFullYear(), month.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start: start.getTime(), end: end.getTime() };
}

export function ReminderCalendarView({ notes }: ReminderCalendarViewProps) {
  const [month, setMonth] = useState(() => new Date());

  const { start, end } = useMemo(() => monthBounds(month), [month]);
  const byDay = useMemo(() => groupByDay(expandOccurrences(notes, start, end)), [notes, start, end]);
  const total = useMemo(() => [...byDay.values()].reduce((sum, list) => sum + list.length, 0), [byDay]);

  const shiftMonth = (delta: number) =>
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));

  const isThisMonth = dayKey(new Date()).slice(0, 7) === dayKey(month).slice(0, 7);

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
            onClick={() => setMonth(new Date())}
            aria-label="Wróć do bieżącego miesiąca"
            className="ml-1 text-xs font-medium text-primary hover:bg-primary/10 px-2.5 py-1 rounded-lg transition-colors"
          >
            Dziś
          </button>
        )}
      </header>

      <div className="rounded-2xl border border-border/50 bg-card/40 px-6 py-12 text-center">
        <CalendarRange className="w-8 h-8 mx-auto text-primary/60 mb-3" />
        {total === 0 ? (
          <>
            <p className="font-display font-semibold text-foreground">Brak terminów w tym miesiącu</p>
            <p className="text-sm text-muted-foreground mt-1">
              Ustaw przypomnienie na notatce, aby zobaczyć je tutaj.
            </p>
          </>
        ) : (
          <>
            <p className="font-display font-semibold text-foreground">
              {total === 1 ? "1 termin w tym miesiącu" : `${total} terminów w ${byDay.size} dniach`}
            </p>
            <p className="text-sm text-muted-foreground mt-1">Siatka miesiąca pojawi się w kolejnym kroku.</p>
          </>
        )}
      </div>
    </motion.section>
  );
}
