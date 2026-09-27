import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, isSameMonth } from "date-fns";
import { pl } from "date-fns/locale";
import { expandOccurrences, groupByDay, dayKey } from "@/lib/reminderOccurrences";
import { MonthGrid } from "./MonthGrid";
import { DayPanel } from "./DayPanel";
import { ReminderQuickAddDialog, type ReminderEditTarget } from "./ReminderQuickAddDialog";
import { toastWithUndo } from "@/lib/undoToast";
import type { ReminderRepeat } from "@/lib/reminderRepeat";
import type { Occurrence } from "@/lib/reminderOccurrences";
import type { Note } from "@/hooks/useNotes";

/**
 * Widok kalendarza przypomnień: siatka miesiąca + lista terminów wybranego dnia.
 *
 * Wystąpienia liczy `expandOccurrences`, więc serie są prognozą rysowaną
 * w locie, nie danymi: edytować da się wyłącznie najbliższe wystąpienie,
 * bo tylko ono istnieje w modelu.
 */

interface ReminderCalendarViewProps {
  /** Notatki z terminami — bez kosza, tak samo jak karmione są powiadomienia. */
  notes: Note[];
  onCreateNote: (title: string, reminder: number, repeat: ReminderRepeat) => void;
  onSetReminder: (noteId: string, reminder: number | null, repeat: ReminderRepeat) => void;
}

function monthBounds(month: Date) {
  return {
    start: new Date(month.getFullYear(), month.getMonth(), 1, 0, 0, 0, 0).getTime(),
    end: new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999).getTime(),
  };
}

export function ReminderCalendarView({ notes, onCreateNote, onSetReminder }: ReminderCalendarViewProps) {
  const [month, setMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [dialogDay, setDialogDay] = useState<Date | null>(null);
  const [editTarget, setEditTarget] = useState<ReminderEditTarget | null>(null);

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

  function openAdd(day: Date) {
    setSelectedDay(day);
    setEditTarget(null);
    setDialogDay(day);
  }

  function openEdit(occ: Occurrence) {
    setEditTarget({ noteId: occ.noteId, at: occ.at, repeat: occ.repeat, isSeries: occ.isSeries });
    setDialogDay(new Date(occ.at));
  }

  /** Cofnięcie przywraca poprzedni termin, więc zapamiętujemy go przed zmianą. */
  function previousOf(noteId: string) {
    const note = notes.find((n) => n.id === noteId);
    return { reminder: note?.reminder ?? null, repeat: note?.reminderRepeat ?? "none" as ReminderRepeat };
  }

  function handleAttach(noteId: string, reminder: number, repeat: ReminderRepeat) {
    const before = previousOf(noteId);
    onSetReminder(noteId, reminder, repeat);
    toastWithUndo("Termin zapisany", () => onSetReminder(noteId, before.reminder, before.repeat), { icon: "🔔" });
  }

  function handleClear(noteId: string) {
    const before = previousOf(noteId);
    onSetReminder(noteId, null, "none");
    toastWithUndo("Termin usunięty", () => onSetReminder(noteId, before.reminder, before.repeat), { icon: "🔕" });
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
        onActivateDay={openAdd}
        onMonthChange={setMonth}
      />

      <DayPanel
        day={selectedDay}
        occurrences={selectedOccurrences}
        titleOf={titleOf}
        onAdd={() => openAdd(selectedDay)}
        onEdit={openEdit}
      />

      {dialogDay && (
        <ReminderQuickAddDialog
          open
          onOpenChange={(v) => { if (!v) { setDialogDay(null); setEditTarget(null); } }}
          day={dialogDay}
          edit={editTarget}
          notes={notes}
          onCreateNote={onCreateNote}
          onAttachReminder={handleAttach}
          onClearReminder={handleClear}
        />
      )}
    </motion.section>
  );
}
