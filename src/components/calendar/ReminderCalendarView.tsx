import { useMemo, useState } from "react";
import {
  DndContext, PointerSensor, TouchSensor, pointerWithin, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Download, Keyboard } from "lucide-react";
import { buildIcs, exportableReminders } from "@/lib/icsExport";
import { download } from "@/lib/exportNotes";
import { addDays, format, isSameDay, isSameMonth } from "date-fns";
import { pl } from "date-fns/locale";
import { expandOccurrences, groupByDay, dayKey } from "@/lib/reminderOccurrences";
import { getNextReminderTime } from "@/lib/reminderRepeat";
import { toast } from "sonner";
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

  /**
   * „Pomiń to wystąpienie” = przesuń zapisany termin na kolejny w serii.
   * Zwykły zapis pola, zero nowych struktur — dokładnie to samo, co robi
   * `useReminderNotifications` po odpaleniu przypomnienia.
   */
  function handleSkip(noteId: string, at: number, repeat: ReminderRepeat) {
    const before = previousOf(noteId);
    onSetReminder(noteId, getNextReminderTime(at, repeat), repeat);
    toastWithUndo("Wystąpienie pominięte", () => onSetReminder(noteId, before.reminder, before.repeat), { icon: "⏭️" });
  }

  /**
   * Prognozy serii nie da się edytować, bo nie istnieje w danych. Zamiast
   * ślepego zaułka przenosimy użytkownika do terminu, który da się zapisać.
   */
  function openSeriesSource(occ: Occurrence) {
    const note = notes.find((n) => n.id === occ.noteId);
    if (!note?.reminder) return;
    const source = new Date(note.reminder);
    setMonth(new Date(source.getFullYear(), source.getMonth(), 1));
    setSelectedDay(source);
    setEditTarget({ noteId: note.id, at: note.reminder, repeat: note.reminderRepeat ?? "none", isSeries: true });
    setDialogDay(source);
    toast("To była prognoza serii", {
      description: `Otwarty został najbliższy zapisany termin: ${format(source, "d MMMM, HH:mm", { locale: pl })}.`,
    });
  }

  function handleClear(noteId: string) {
    const before = previousOf(noteId);
    onSetReminder(noteId, null, "none");
    toastWithUndo("Termin usunięty", () => onSetReminder(noteId, before.reminder, before.repeat), { icon: "🔕" });
  }

  // Własny `DndContext`: zagnieżdżony kontekst przechwytuje przeciągnięcia
  // chipów, więc `useNoteDnd` (reorder notatek, globalny `sortKey`) nigdy
  // ich nie widzi.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  /** Przeniesienie na inny dzień zachowuje godzinę; seria przesuwa się cała. */
  function moveToDay(occ: Occurrence, day: Date) {
    const from = new Date(occ.at);
    if (isSameDay(from, day)) return;
    const to = new Date(day.getFullYear(), day.getMonth(), day.getDate(), from.getHours(), from.getMinutes());
    const before = previousOf(occ.noteId);
    onSetReminder(occ.noteId, to.getTime(), occ.repeat);
    setSelectedDay(to);
    if (!isSameMonth(to, month)) setMonth(new Date(to.getFullYear(), to.getMonth(), 1));
    toastWithUndo(
      `Termin przeniesiony na ${format(to, "d MMMM", { locale: pl })}`,
      () => onSetReminder(occ.noteId, before.reminder, before.repeat),
      { icon: "📅", description: occ.isSeries ? "Cała seria liczy się od nowego terminu." : undefined },
    );
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    const occ = active.data.current?.occurrence as Occurrence | undefined;
    const day = over?.data.current?.day as Date | undefined;
    if (occ && day) moveToDay(occ, day);
  }

  function exportIcs(list: Note[], filename: string) {
    download(buildIcs(list), filename, "text/calendar;charset=utf-8");
  }

  function exportOne(occ: Occurrence) {
    const note = notes.find((n) => n.id === occ.noteId);
    if (!note) return;
    exportIcs([note], `przypomnienie-${format(new Date(occ.at), "yyyy-MM-dd")}.ics`);
    toast("Pobrano plik .ics", { description: "Otwórz go, żeby dodać termin do kalendarza systemowego." });
  }

  function exportAll() {
    const list = exportableReminders(notes);
    if (list.length === 0) { toast.info("Brak nadchodzących terminów do eksportu"); return; }
    exportIcs(list, `przypomnienia-${format(new Date(), "yyyy-MM-dd")}.ics`);
    const n = list.length;
    const word = n === 1 ? "termin" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "terminy" : "terminów";
    toast(`Pobrano ${n} ${word} (.ics)`, {
      description: "Ponowny import zaktualizuje wpisy zamiast je dublować.",
    });
  }

  const isThisMonth = isSameMonth(month, new Date());
  const selectedOccurrences = byDay.get(dayKey(selectedDay)) ?? [];

  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <header className="flex items-center gap-1 sm:gap-2">
        <button
          onClick={() => shiftMonth(-1)}
          aria-label="Poprzedni miesiąc"
          className="p-2 shrink-0 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h2
          aria-live="polite"
          className="font-display font-bold text-base sm:text-lg capitalize text-center truncate sm:min-w-[11ch]"
        >
          {format(month, "LLLL yyyy", { locale: pl })}
        </h2>
        <button
          onClick={() => shiftMonth(1)}
          aria-label="Następny miesiąc"
          className="p-2 shrink-0 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        {!isThisMonth && (
          <button
            onClick={goToToday}
            aria-label="Wróć do bieżącego miesiąca"
            className="ml-1 shrink-0 text-xs font-medium text-primary hover:bg-primary/10 px-2 sm:px-2.5 py-1 rounded-lg transition-colors"
          >
            Dziś
          </button>
        )}
        <button
          onClick={exportAll}
          aria-label="Eksportuj nadchodzące terminy do kalendarza (.ics)"
          title="Eksportuj nadchodzące terminy do kalendarza (.ics)"
          className="ml-auto sm:ml-0 order-last shrink-0 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 px-2 py-1.5 rounded-lg transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">.ics</span>
        </button>
        {/* Ściągawka skrótów w podpowiedzi zamiast stałego tekstu w nagłówku. */}
        <span
          title="↑↓←→ — dni · PgUp/PgDn — miesiąc · Enter — dodaj termin · przeciągnij termin lub Shift+←/→"
          className="ml-auto hidden sm:inline-flex p-2 text-muted-foreground"
        >
          <Keyboard className="w-4 h-4" aria-hidden />
          <span className="sr-only">Skróty: strzałki — dni, PgUp/PgDn — miesiąc, Enter — dodaj termin, Shift+strzałki — przesuń termin</span>
        </span>
      </header>

      <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={handleDragEnd}>
      <MonthGrid
        month={month}
        byDay={byDay}
        titleOf={titleOf}
        selectedDay={selectedDay}
        onSelectDay={setSelectedDay}
        onActivateDay={openAdd}
        onMonthChange={setMonth}
      />
      </DndContext>

      <DayPanel
        day={selectedDay}
        occurrences={selectedOccurrences}
        titleOf={titleOf}
        onAdd={() => openAdd(selectedDay)}
        onEdit={openEdit}
        onExport={exportOne}
        onMoveByDays={(occ, days) => moveToDay(occ, addDays(new Date(occ.at), days))}
        onOpenSeriesSource={openSeriesSource}
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
          onSkipOccurrence={handleSkip}
        />
      )}
    </motion.section>
  );
}
