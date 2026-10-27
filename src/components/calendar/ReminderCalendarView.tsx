import { useCallback, useMemo, useState } from "react";
import { useNotesContext } from "@/hooks/NotesProvider";
import { useDayClock } from "@/lib/dayClock";
import {
  DndContext, PointerSensor, TouchSensor, pointerWithin, useSensor, useSensors,
} from "@dnd-kit/core";
import { PrintRoot } from "@/components/study/PrintRoot";
import { CalendarPrintList } from "./CalendarPrintList";
import { addDays, format } from "date-fns";
import { pl } from "date-fns/locale";
import { expandOccurrences, groupByDay, dayKey } from "@/lib/reminderOccurrences";
import { ruleOf, type RepeatInput } from "@/lib/reminderRepeat";
import { toast } from "sonner";
import { dayType, setDayEntry, useShifts, type ShiftType } from "@/lib/shifts";
import { useStudyDayMarks } from "./useStudyDayMarks";
import { DayDialog } from "@/components/shifts/DayDialog";
import { MonthGrid } from "./MonthGrid";
import { MonthAgenda } from "./MonthAgenda";
import { DayPanel } from "./DayPanel";
import { UpcomingDays } from "./UpcomingDays";
import { WeekStrip } from "./WeekStrip";
import { ReminderQuickAddDialog, type ReminderEditTarget } from "./ReminderQuickAddDialog";
import { CalendarHeader } from "./CalendarHeader";
import { useCalendarMoves } from "./useCalendarMoves";
import { exportOneReminder, exportAllReminders } from "./calendarExport";
import { toastWithUndo } from "@/lib/undoToast";
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
  /** `until` — koniec serii, `undefined` = bez końca. */
  onCreateNote: (title: string, reminder: number, repeat: RepeatInput, allDay: boolean, until?: number) => void;
  /** `reminderDay` podany = przesunięcie w obrębie serii (bez zmiany jej dnia); brak = nowy termin. */
  /** `reminderBase` — termin serii przy odłożonym wystąpieniu (`undefined` = zwykły termin, czyści odłożenie).
   *  `until` — koniec serii; każde wywołanie podaje go jawnie (ruch, pominięcie, cofnięcie zachowują stary), bo `undefined` czyści. */
  onSetReminder: (noteId: string, reminder: number | null, repeat: RepeatInput, reminderDay?: number, reminderBase?: number, reminderAllDay?: boolean, until?: number) => void;
}

function monthBounds(month: Date) {
  return {
    start: new Date(month.getFullYear(), month.getMonth(), 1, 0, 0, 0, 0).getTime(),
    end: new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999).getTime(),
  };
}

export function ReminderCalendarView({ notes, onCreateNote, onSetReminder }: ReminderCalendarViewProps) {
  const { updateNote } = useNotesContext();
  // „Dziś” w siatce, pasku tygodnia i najbliższych dniach liczone przy renderze —
  // sygnał zegara dnia przerysowuje je po północy i po powrocie do karty.
  useDayClock();
  const [month, setMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [showKeys, setShowKeys] = useState(false);
  const [dialogDay, setDialogDay] = useState<Date | null>(null);
  // Telefon: miesiąc (siatka) albo tydzień (pasek 7 dni). Na większym ekranie oba są zawsze.
  const [phoneView, setPhoneView] = useState<"month" | "week" | "agenda">("month");
  // Wydruk miesiąca (3b planu): `PrintRoot` schowa resztę strony i otworzy okno drukowania.
  const [printing, setPrinting] = useState(false);
  const [editTarget, setEditTarget] = useState<ReminderEditTarget | null>(null);

  // Siatka pokazuje też dni sąsiednich miesięcy, więc zakres jest o tydzień
  // szerszy z każdej strony — inaczej skrajne komórki byłyby zawsze puste.
  const { start, end } = useMemo(() => monthBounds(month), [month]);
  const WEEK = 7 * 24 * 3600_000;
  const byDay = useMemo(
    () => groupByDay(expandOccurrences(notes, start - WEEK, end + WEEK)),
    [notes, start, end, WEEK],
  );

  const notesById = useMemo(() => new Map(notes.map((n) => [n.id, n])), [notes]);

  const titleOf = useMemo(() => {
    const titles = new Map(notes.map((n) => [n.id, n.locked ? "Notatka prywatna" : n.title || n.content.slice(0, 40)]));
    return (id: string) => titles.get(id) ?? "";
  }, [notes]);

  // Zmiany z Grafiku w komórkach i w panelu dnia — jeden widok „co mam tego dnia”.
  const shifts = useShifts();
  // Typy dni liczone raz na zmianę danych: `dayType` tworzy nowy obiekt, a `memo(DayCell)` porównuje referencje.
  const shiftOf = useMemo(() => {
    const types = new Map(shifts.types.map((t) => [t.id, t]));
    const resolved = new Map<string, ShiftType>();
    for (const [key, entry] of Object.entries(shifts.days)) {
      const base = types.get(entry.type);
      if (base) resolved.set(key, dayType(base, entry));
    }
    return (key: string) => resolved.get(key);
  }, [shifts]);

  // Praca w komórkach: wizyty serwisowe i dostawy (K2), tylko odczyt.
  const studyMarks = useStudyDayMarks();
  // Stabilna funkcja dla siatki: `memo(DayCell)` nie przerysowuje komórek przy każdym kliknięciu (K5.1).
  const studyOf = useCallback((key: string) => studyMarks.get(key), [studyMarks]);

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

  const openAdd = useCallback((day: Date) => {
    setSelectedDay(day);
    setEditTarget(null);
    setDialogDay(day);
  }, []);

  function openEdit(occ: Occurrence) {
    const note = notesById.get(occ.noteId);
    setEditTarget({ noteId: occ.noteId, at: occ.at, repeat: occ.repeat, isSeries: occ.isSeries, allDay: occ.allDay, base: note?.reminderBase, until: note?.reminderRepeatUntil });
    setDialogDay(new Date(occ.at));
  }

  const { handleAttach, handleSkip, handleClear, moveToDay, handleDragEnd } = useCalendarMoves({
    notesById, onSetReminder, month, setMonth, selectedDay, setSelectedDay,
  });

  /**
   * Prognozy serii nie da się edytować, bo nie istnieje w danych. Zamiast
   * ślepego zaułka przenosimy użytkownika do terminu, który da się zapisać.
   */
  function openSeriesSource(occ: Occurrence) {
    const note = notesById.get(occ.noteId);
    if (!note?.reminder) return;
    const source = new Date(note.reminder);
    setMonth(new Date(source.getFullYear(), source.getMonth(), 1));
    setSelectedDay(source);
    setEditTarget({ noteId: note.id, at: note.reminder, repeat: ruleOf(note), isSeries: true, allDay: note.reminderAllDay === true, until: note.reminderRepeatUntil });
    setDialogDay(source);
    toast("To była prognoza serii", {
      description: `Otwarty został najbliższy zapisany termin: ${format(source, "d MMMM, HH:mm", { locale: pl })}.`,
    });
  }

  // Własny `DndContext`: zagnieżdżony kontekst przechwytuje przeciągnięcia
  // chipów, więc `useNoteDnd` (reorder notatek, globalny `sortKey`) nigdy
  // ich nie widzi.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  function exportOne(occ: Occurrence) {
    const note = notesById.get(occ.noteId);
    if (note) exportOneReminder(note, occ.at);
  }

  const exportAll = () => exportAllReminders(notes);

  const selectedOccurrences = byDay.get(dayKey(selectedDay)) ?? [];

  return (
    // Pierwsze wejście (leniwy moduł dochodzi po zmianie widoku) — te same 6 px
    // i krzywa co przejście między widokami w Index.
    // Telefon i laptop: jedna kolumna w dawnej kolejności (`contents` + `order`). Szeroki ekran (xl):
    // miesiąc po lewej, po prawej przyklejone najbliższe terminy i panel wybranego dnia (plan UI 2.3).
    <section className="rise-in flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start xl:gap-8">
      <div className="contents xl:flex xl:flex-col xl:gap-4 xl:min-w-0">
        <CalendarHeader
          month={month}
          selectedDay={selectedDay}
          showKeys={showKeys}
          onPrev={() => shiftMonth(-1)}
          onNext={() => shiftMonth(1)}
          onToday={goToToday}
          onToggleKeys={() => setShowKeys((v) => !v)}
          onPrint={() => setPrinting(true)}
          onExportAll={exportAll}
        />
        {printing && (
          <PrintRoot testId="calendar-print" onDone={() => setPrinting(false)}>
            <CalendarPrintList month={month} byDay={byDay} titleOf={titleOf} />
          </PrintRoot>
        )}
        <div role="group" aria-label="Widok na telefonie" className="order-3 flex gap-1 sm:hidden">
            {(["month", "week", "agenda"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={phoneView === v}
                onClick={() => setPhoneView(v)}
                className={`rounded-field px-3 py-1.5 text-xs font-medium coarse:min-h-11 outline-hidden focus-visible:ring-2 focus-visible:ring-ring ${phoneView === v ? "bg-primary/10 text-primary-ink" : "text-muted-foreground hover:text-foreground"}`}
              >
                {v === "month" ? "Miesiąc" : v === "week" ? "Tydzień" : "Lista"}
              </button>
            ))}
        </div>
        {showKeys && (
          <p id="calendar-keys-hint" className="order-2 -mt-2 px-1 text-xs text-muted-foreground">
            Strzałki — przechodzenie po dniach · PgUp / PgDn — miesiąc · Enter — dodaj termin · Z — zmiana i godziny z Grafiku · Shift+←/→ — przesuń wybrany termin o dzień (albo przeciągnij go myszą).
          </p>
        )}

        {/* Telefon: bieżący tydzień i tak jest wierszem siatki miesiąca tuż pod spodem — pasek go dublował. */}
        <div className={phoneView === "week" ? "order-4" : "order-4 max-sm:hidden"}>
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

        {/* K-3 (plan Kalendarza 3.4): agenda miesiąca na telefonie — trzeci widok, bez pustych dni. */}
        <div className={phoneView === "agenda" ? "order-5 sm:hidden" : "hidden"}>
          <MonthAgenda
            month={month}
            byDay={byDay}
            titleOf={titleOf}
            shiftOf={(key) => { const t = shiftOf(key); return t ? `${t.name} ${t.start}–${t.end}` : undefined; }}
            onSelectDay={(key) => { const [y, m, d] = key.split("-").map(Number); const day = new Date(y, m - 1, d); setSelectedDay(day); setPhoneView("month"); setMonth(new Date(y, m - 1, 1)); }}
          />
        </div>
        <div className={phoneView === "month" ? "order-5" : "order-5 max-sm:hidden"}>
          <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={handleDragEnd}>
          <MonthGrid
            month={month}
            byDay={byDay}
            titleOf={titleOf}
            shiftOf={shiftOf}
            studyOf={studyOf}
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
            study={studyMarks.get(dayKey(selectedDay))}
            onEditShift={shifts.types.length > 0 ? () => setShiftDay(dayKey(selectedDay)) : undefined}
            onCopyPrevShift={shifts.types.length > 0 && !shifts.days[dayKey(selectedDay)] && prevShiftEntry(dayKey(selectedDay))
              ? () => copyPrevShift(dayKey(selectedDay)) : undefined}
            onAdd={() => openAdd(selectedDay)}
            onEdit={openEdit}
            onExport={exportOne}
            onSkip={(occ) => handleSkip(occ.noteId, occ.at, occ.repeat)}
            onMoveByDays={(occ, days) => moveToDay(occ, addDays(new Date(occ.at), days))}
            onOpenSeriesSource={openSeriesSource}
            noteOf={(id) => notesById.get(id)}
            onUpdateNote={updateNote}
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
    </section>
  );
}
