import { useMemo, useState } from "react";
import { pluralPl } from "@/lib/plural";
import { useDayClock } from "@/lib/dayClock";
import {
  DndContext, PointerSensor, TouchSensor, pointerWithin, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import { m as motion } from "framer-motion";
import { tween } from "@/lib/motion";
import { ChevronLeft, ChevronRight, Download, Keyboard } from "lucide-react";
import { buildIcs, exportableReminders } from "@/lib/icsExport";
import { download } from "@/lib/exportNotes";
import { addDays, format, isSameDay, isSameMonth } from "date-fns";
import { pl } from "date-fns/locale";
import { expandOccurrences, groupByDay, dayKey } from "@/lib/reminderOccurrences";
import { nextInSeries, seriesDay } from "@/lib/reminderRepeat";
import { toast } from "sonner";
import { dayType, setDayEntry, useShifts } from "@/lib/shifts";
import { useStudyDayMarks } from "./useStudyDayMarks";
import { DayDialog } from "@/components/shifts/DayDialog";
import { MonthGrid } from "./MonthGrid";
import { markMoved } from "./movedSignal";
import { DayPanel } from "./DayPanel";
import { UpcomingDays } from "./UpcomingDays";
import { WeekStrip } from "./WeekStrip";
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
  /** `reminderDay` podany = przesunięcie w obrębie serii (bez zmiany jej dnia); brak = nowy termin. */
  onSetReminder: (noteId: string, reminder: number | null, repeat: ReminderRepeat, reminderDay?: number) => void;
}

function monthBounds(month: Date) {
  return {
    start: new Date(month.getFullYear(), month.getMonth(), 1, 0, 0, 0, 0).getTime(),
    end: new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999).getTime(),
  };
}

export function ReminderCalendarView({ notes, onCreateNote, onSetReminder }: ReminderCalendarViewProps) {
  // „Dziś” w siatce, pasku tygodnia i najbliższych dniach liczone przy renderze —
  // sygnał zegara dnia przerysowuje je po północy i po powrocie do karty.
  useDayClock();
  const [month, setMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [showKeys, setShowKeys] = useState(false);
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
    const titles = new Map(notes.map((n) => [n.id, n.locked ? "Notatka prywatna" : n.title || n.content.slice(0, 40)]));
    return (id: string) => titles.get(id) ?? "";
  }, [notes]);

  // Zmiany z Grafiku w komórkach i w panelu dnia — jeden widok „co mam tego dnia”.
  const shifts = useShifts();
  const shiftOf = useMemo(() => {
    const types = new Map(shifts.types.map((t) => [t.id, t]));
    return (key: string) => {
      const entry = shifts.days[key];
      const base = entry && types.get(entry.type);
      return base ? dayType(base, entry) : undefined;
    };
  }, [shifts]);

  // Praca w komórkach: wizyty serwisowe i dostawy (K2), tylko odczyt.
  const studyMarks = useStudyDayMarks();

  // Okno dnia z Grafiku otwierane z kalendarza: ręczna zmiana rodzaju zmiany i godzin bez przechodzenia do Grafiku.
  const [shiftDay, setShiftDay] = useState<string | null>(null);
  const prevShiftEntry = (key: string) => {
    const [y, m, d] = key.split("-").map(Number);
    return shifts.days[dayKey(addDays(new Date(y, m - 1, d), -1))];
  };
  /** „Jak poprzedni dzień”: ten sam rodzaj i godziny, bez notatki i znaczników premii (te dotyczą konkretnego dnia). */
  const copyPrevShift = (key: string) => {
    const prev = prevShiftEntry(key);
    if (!prev || shifts.days[key]) return;
    const { type, hours, customHours, extraMin } = prev;
    setDayEntry(key, { type, ...(hours ? { hours } : {}), ...(customHours ? { customHours } : {}), ...(extraMin ? { extraMin } : {}) });
    toastWithUndo("Wpisano zmianę z poprzedniego dnia", () => setDayEntry(key, null), { icon: "🗓️" });
  };

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
    return {
      reminder: note?.reminder ?? null,
      repeat: note?.reminderRepeat ?? "none" as ReminderRepeat,
      day: note ? seriesDay(note) : undefined,
      until: note?.reminderRepeatUntil,
    };
  }

  function handleAttach(noteId: string, reminder: number, repeat: ReminderRepeat) {
    const before = previousOf(noteId);
    onSetReminder(noteId, reminder, repeat);
    toastWithUndo("Termin zapisany", () => onSetReminder(noteId, before.reminder, before.repeat, before.day), { icon: "🔔" });
  }

  /**
   * „Pomiń to wystąpienie” = przesuń zapisany termin na kolejny w serii.
   * Zwykły zapis pola, zero nowych struktur — dokładnie to samo, co robi
   * `useReminderNotifications` po odpaleniu przypomnienia.
   */
  function handleSkip(noteId: string, at: number, repeat: ReminderRepeat) {
    const before = previousOf(noteId);
    const next = nextInSeries(at, repeat, before.day, before.until);
    // Pominięcie ostatniego terminu serii kończy ją — nie ma już czego przypominać.
    if (next === null) onSetReminder(noteId, null, "none");
    else onSetReminder(noteId, next, repeat, before.day);
    toastWithUndo("Wystąpienie pominięte", () => onSetReminder(noteId, before.reminder, before.repeat, before.day), { icon: "⏭️" });
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
    toastWithUndo("Termin usunięty", () => onSetReminder(noteId, before.reminder, before.repeat, before.day), { icon: "🔕" });
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
    markMoved(occ.noteId);
    onSetReminder(occ.noteId, to.getTime(), occ.repeat);
    setSelectedDay(to);
    if (!isSameMonth(to, month)) setMonth(new Date(to.getFullYear(), to.getMonth(), 1));
    toastWithUndo(
      `Termin przeniesiony na ${format(to, "d MMMM", { locale: pl })}`,
      () => onSetReminder(occ.noteId, before.reminder, before.repeat, before.day),
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
    toast(`Pobrano ${n} ${pluralPl(n, ["termin", "terminy", "terminów"])} (.ics)`, {
      description: "Ponowny import zaktualizuje wpisy zamiast je dublować.",
    });
  }

  const isThisMonth = isSameMonth(month, new Date());
  const selectedOccurrences = byDay.get(dayKey(selectedDay)) ?? [];

  return (
    // Pierwsze wejście (leniwy moduł dochodzi po zmianie widoku) — te same 6 px
    // i krzywa co przejście między widokami w Index.
    // Telefon i laptop: jedna kolumna w dawnej kolejności (`contents` + `order`). Szeroki ekran (xl):
    // miesiąc po lewej, po prawej przyklejone najbliższe terminy i panel wybranego dnia (plan UI 2.3).
    <motion.section initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={tween.enter}
      className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start xl:gap-8">
      <div className="contents xl:flex xl:flex-col xl:gap-4 xl:min-w-0">
        <header className="order-1 flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => shiftMonth(-1)}
            aria-label="Poprzedni miesiąc"
            className="inline-flex items-center justify-center p-2 coarse:min-h-11 coarse:min-w-11 shrink-0 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
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
            className="inline-flex items-center justify-center p-2 coarse:min-h-11 coarse:min-w-11 shrink-0 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {!isThisMonth && (
            <button
              onClick={goToToday}
              aria-label="Wróć do bieżącego miesiąca"
              className="ml-1 shrink-0 text-xs font-medium text-primary-ink hover:bg-primary/10 px-2 sm:px-2.5 py-1 coarse:min-h-11 coarse:px-3 rounded-lg transition-colors outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            >
              Dziś
            </button>
          )}
          <button
            onClick={exportAll}
            aria-label="Eksportuj nadchodzące terminy do kalendarza (.ics)"
            title="Eksportuj nadchodzące terminy do kalendarza (.ics)"
            className="ml-auto sm:ml-0 order-last shrink-0 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 px-2 py-1.5 coarse:min-h-11 coarse:min-w-11 coarse:justify-center rounded-lg transition-colors outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">.ics</span>
          </button>
          {/* Ściągawka skrótów w podpowiedzi zamiast stałego tekstu w nagłówku. */}
          <button
            type="button"
            onClick={() => setShowKeys((v) => !v)}
            aria-expanded={showKeys}
            aria-controls="calendar-keys-hint"
            aria-label="Skróty klawiaturowe kalendarza"
            title="Skróty klawiaturowe"
            className="ml-auto hidden sm:inline-flex p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Keyboard className="w-4 h-4" aria-hidden />
          </button>
        </header>
        {showKeys && (
          <p id="calendar-keys-hint" className="order-2 -mt-2 px-1 text-xs text-muted-foreground">
            Strzałki — przechodzenie po dniach · PgUp / PgDn — miesiąc · Enter — dodaj termin · Z — zmiana i godziny z Grafiku · Shift+←/→ — przesuń wybrany termin o dzień (albo przeciągnij go myszą).
          </p>
        )}

        {/* Telefon: bieżący tydzień i tak jest wierszem siatki miesiąca tuż pod spodem — pasek go dublował. */}
        <div className="order-4 max-sm:hidden">
        <WeekStrip
          day={selectedDay}
          byDay={byDay}
          shiftOf={shiftOf}
          onSelectDay={(day) => {
            setSelectedDay(day);
            setMonth((m) => (m.getFullYear() === day.getFullYear() && m.getMonth() === day.getMonth() ? m : new Date(day.getFullYear(), day.getMonth(), 1)));
          }}
        />
        </div>

        <div className="order-5">
          <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={handleDragEnd}>
          <MonthGrid
            month={month}
            byDay={byDay}
            titleOf={titleOf}
            shiftOf={shiftOf}
            studyOf={(key) => studyMarks.get(key)}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            onActivateDay={openAdd}
            onEditShift={shifts.types.length > 0 ? (day) => setShiftDay(dayKey(day)) : undefined}
            onMonthChange={setMonth}
          />
          </DndContext>

        </div>
      </div>

      <aside aria-label="Wybrany dzień i najbliższe terminy" className="contents xl:flex xl:flex-col xl:gap-4 xl:sticky xl:top-24 xl:max-h-[calc(100dvh-7rem)] xl:overflow-y-auto xl:overscroll-contain xl:pb-2">
        <div className="order-3 empty:hidden">
          <UpcomingDays
            notes={notes}
            titleOf={titleOf}
            shiftOf={shiftOf}
            onSelectDay={(day) => {
              setSelectedDay(day);
              setMonth(new Date(day.getFullYear(), day.getMonth(), 1));
            }}
          />

        </div>
        <div className="order-6">
          <DayPanel
            day={selectedDay}
            occurrences={selectedOccurrences}
            titleOf={titleOf}
            shift={shiftOf(dayKey(selectedDay))}
            onEditShift={shifts.types.length > 0 ? () => setShiftDay(dayKey(selectedDay)) : undefined}
            onCopyPrevShift={shifts.types.length > 0 && !shifts.days[dayKey(selectedDay)] && prevShiftEntry(dayKey(selectedDay))
              ? () => copyPrevShift(dayKey(selectedDay)) : undefined}
            onAdd={() => openAdd(selectedDay)}
            onEdit={openEdit}
            onExport={exportOne}
            onMoveByDays={(occ, days) => moveToDay(occ, addDays(new Date(occ.at), days))}
            onOpenSeriesSource={openSeriesSource}
          />

        </div>
      </aside>

      <DayDialog
        dayKey={shiftDay}
        entry={shiftDay ? shifts.days[shiftDay] : undefined}
        types={shifts.types}
        onOpenChange={(open) => { if (!open) setShiftDay(null); }}
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
