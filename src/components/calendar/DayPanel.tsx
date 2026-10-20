import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { useState } from "react";
import { CalendarPlus, Plus, Pencil, ArrowRight, Download, Clock, Copy, List, HardHat, SkipForward } from "lucide-react";
import { studySummary, type StudyDayMarks } from "@/lib/study/calendarMarks";
import { ReminderChip } from "./ReminderChip";
import { DayTimeline } from "./DayTimeline";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Occurrence } from "@/lib/reminderOccurrences";
import { REMINDER_REPEAT_LABELS } from "@/lib/reminderRepeat";
import { shiftInk, shiftLabel, shiftTextOnCard, type ShiftType } from "@/lib/shifts";

/**
 * Terminy wybranego dnia — tu mieszczą się pełne tytuły, których komórka siatki
 * nie pomieści. Dwa widoki: lista (domyślna) i oś godzin (`DayTimeline`). Oś rysuje
 * zmianę z Grafiku jako blok, bo ma godziny, a przypomnienia jako punkty w swojej godzinie.
 *
 * Wszystkie akcje (dodaj, edytuj) siedzą tutaj, a nie w komórkach siatki:
 * siatka zostaje jednym przystankiem tabulatora z nawigacją strzałkami,
 * a przyciski w komórkach rozbiłyby ten model obsługi klawiaturą.
 */

interface DayPanelProps {
  day: Date;
  occurrences: Occurrence[];
  titleOf: (noteId: string) => string;
  /** Zmiana z Grafiku w tym dniu — pokazana nad terminami, żeby „co mam tego dnia” było w jednym miejscu. */
  shift?: ShiftType;
  /** Wizyty i dostawy z Pracy tego dnia — w komórce są tylko liczniki, tu pełna informacja (1d planu). */
  study?: StudyDayMarks;
  onAdd: () => void;
  onEdit: (occurrence: Occurrence) => void;
  /** Shift+←/→ na terminie — klawiaturowy odpowiednik przeciągania (WCAG 2.5.7). */
  onMoveByDays: (occurrence: Occurrence, days: number) => void;
  /** Pobiera `.ics` z tym terminem — kalendarz systemowy przypomni przy zamkniętej aplikacji. */
  onExport: (occurrence: Occurrence) => void;
  /** Pomija wystąpienie serii bez otwierania dialogu. Brak = przycisku nie ma. */
  onSkip?: (occurrence: Occurrence) => void;
  /** Klik w prognozę serii — prowadzi do najbliższego, zapisanego terminu. */
  onOpenSeriesSource: (occurrence: Occurrence) => void;
  /** Otwiera okno dnia z Grafiku (rodzaj zmiany i godziny wpisane ręcznie). Brak = tylko podgląd. */
  onEditShift?: () => void;
  /** Wpisuje zmianę z poprzedniego dnia; podane tylko, gdy dzień jest pusty, a poprzedni ma zmianę. */
  onCopyPrevShift?: () => void;
}

type DayView = "list" | "axis";

const DAY_VIEW_KEY = "kaczy.calendar.dayView";

/** Wybór listy/osi zapamiętany w tej przeglądarce (2c planu). Błąd dostępu = domyślna lista. */
function readDayView(): DayView {
  try {
    return localStorage.getItem(DAY_VIEW_KEY) === "axis" ? "axis" : "list";
  } catch {
    return "list";
  }
}

function writeDayView(view: DayView) {
  try { localStorage.setItem(DAY_VIEW_KEY, view); } catch { /* bez zapisu zostaje wybór na czas sesji */ }
}

export function DayPanel({ day, occurrences, titleOf, shift, study, onAdd, onEdit, onMoveByDays, onExport, onSkip, onOpenSeriesSource, onEditShift, onCopyPrevShift }: DayPanelProps) {
  const [view, setViewState] = useState<DayView>(readDayView);
  function setView(next: DayView) {
    setViewState(next);
    writeDayView(next);
  }
  const emptyHint = (
    <p className="text-sm text-muted-foreground flex items-center gap-2">
      <CalendarPlus className="w-4 h-4 shrink-0 text-muted-foreground/70" />
      Brak terminów tego dnia.
    </p>
  );
  return (
    <section aria-label="Terminy wybranego dnia" className="rounded-card border border-border/50 bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <h3 aria-live="polite" className="font-display font-semibold text-sm first-letter:uppercase">
          {format(day, "EEEE, d MMMM", { locale: pl })}
        </h3>
        <button
          onClick={onAdd}
          className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary-ink hover:bg-primary/10 px-2 py-1 coarse:min-h-11 coarse:px-3 rounded-lg transition-colors outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="w-3.5 h-3.5" />
          Dodaj termin
        </button>
      </div>

      <ToggleGroup
        variant="plain"
        value={view}
        onValueChange={(v) => { if (v) setView(v as DayView); }}
        aria-label="Widok terminów dnia"
        className="mb-3 inline-flex gap-0.5 rounded-lg bg-muted/50 p-0.5"
      >
        <ToggleGroupItem value="list" className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground data-[state=on]:bg-card data-[state=on]:text-primary-ink data-[state=on]:shadow-sm coarse:min-h-11 outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
          <List className="w-3.5 h-3.5" aria-hidden />
          Lista
        </ToggleGroupItem>
        <ToggleGroupItem value="axis" className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground data-[state=on]:bg-card data-[state=on]:text-primary-ink data-[state=on]:shadow-sm coarse:min-h-11 outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
          <Clock className="w-3.5 h-3.5" aria-hidden />
          Oś godzin
        </ToggleGroupItem>
      </ToggleGroup>

      {studySummary(study) && (
        <p className="flex items-center gap-2 text-sm mb-3">
          <HardHat className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>{studySummary(study)}</span>
        </p>
      )}

      {shift && (
        <p className="flex items-center gap-2 text-sm mb-3">
          <span
            aria-hidden
            className={`rounded px-1.5 font-display font-bold text-xs leading-5 ${shift.kind === "absence" ? "border" : ""}`}
            style={shift.kind === "absence"
              ? { borderColor: shift.color, backgroundColor: `color-mix(in srgb, ${shift.color} 16%, transparent)`, color: shiftTextOnCard(shift.color) }
              : { backgroundColor: shift.color, color: shiftInk(shift.color) }}
          >
            {shift.short}
          </span>
          <span><span className="sr-only">Zmiana w Grafiku: </span>{shiftLabel(shift)}</span>
          {onEditShift && (
            <button
              type="button"
              onClick={onEditShift}
              aria-keyshortcuts="Z"
              title="Zmień rodzaj zmiany i godziny tego dnia (Z)"
              className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary-ink hover:bg-primary/10 px-2 py-1 coarse:min-h-11 coarse:px-3 rounded-lg transition-colors outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Clock className="w-3.5 h-3.5" aria-hidden />
              Zmień godziny
            </button>
          )}
        </p>
      )}
      {!shift && onEditShift && (
        <div className="flex flex-wrap items-center gap-1 mb-3 -mx-2">
          <button
            type="button"
            onClick={onEditShift}
            aria-keyshortcuts="Z"
            title="Wpisz zmianę z Grafiku w tym dniu (Z)"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary-ink hover:bg-primary/10 px-2 py-1 coarse:min-h-11 coarse:px-3 rounded-lg transition-colors outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Clock className="w-3.5 h-3.5" aria-hidden />
            Dodaj zmianę
          </button>
          {onCopyPrevShift && (
            <button
              type="button"
              onClick={onCopyPrevShift}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted px-2 py-1 coarse:min-h-11 coarse:px-3 rounded-lg transition-colors outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Copy className="w-3.5 h-3.5" aria-hidden />
              Jak poprzedni dzień
            </button>
          )}
        </div>
      )}

      {view === "axis" ? (
        <>
          {occurrences.length === 0 && emptyHint}
          <DayTimeline
            occurrences={occurrences}
            titleOf={titleOf}
            shift={shift}
            onEdit={onEdit}
            onMoveByDays={onMoveByDays}
            onOpenSeriesSource={onOpenSeriesSource}
          />
        </>
      ) : occurrences.length === 0 ? (
        emptyHint
      ) : (
        <ul className="space-y-1.5">
          {occurrences.map((occ, i) => {
            const title = titleOf(occ.noteId);
            const forecast = occ.isSeries && !occ.isNext;
            return (
              // Wejście ze stagger 40 ms — przy zmianie dnia klucze są nowe, więc lista wjeżdża na nowo.
              <li key={`${occ.noteId}-${occ.at}`} className="rise-in" style={{ "--i": Math.min(i, 6) } as React.CSSProperties}>
                {forecast ? (
                  <>
                    <button
                      onClick={() => onOpenSeriesSource(occ)}
                      aria-label={`Prognoza serii: ${title.trim() || "Bez tytułu"} — przejdź do najbliższego terminu`}
                      className="group w-full flex items-center gap-2 rounded-lg hover:bg-muted/60 transition-colors p-1 -m-1 coarse:min-h-11 outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <ReminderChip occurrence={occ} title={title} detailed className="min-w-0 flex-1" />
                      <ArrowRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground opacity-0 coarse:opacity-100 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity" />
                    </button>
                    <p className="text-2xs text-muted-foreground pl-2 mt-0.5">
                      Prognoza serii — zapisany jest tylko najbliższy termin.
                    </p>
                  </>
                ) : (
                  <div className="flex items-center gap-1">
                  <button
                    onClick={() => onEdit(occ)}
                    onKeyDown={(e) => {
                      if (!e.shiftKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
                      e.preventDefault();
                      onMoveByDays(occ, e.key === "ArrowRight" ? 1 : -1);
                    }}
                    aria-label={`Edytuj termin: ${title.trim() || "Bez tytułu"}, ${format(new Date(occ.at), "HH:mm")}${occ.repeat !== "none" ? `, powtarza się: ${REMINDER_REPEAT_LABELS[occ.repeat].toLowerCase()}` : ""}`}
                    aria-keyshortcuts="Shift+ArrowLeft Shift+ArrowRight"
                    title="Shift+←/→ — przesuń o dzień"
                    className="group w-full flex items-center gap-2 rounded-lg hover:bg-muted/60 transition-colors p-1 -m-1 coarse:min-h-11 outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ReminderChip occurrence={occ} title={title} detailed className="min-w-0 flex-1" />
                    <Pencil className="w-3.5 h-3.5 shrink-0 text-muted-foreground opacity-0 coarse:opacity-100 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity" />
                  </button>
                  <button
                    onClick={() => onExport(occ)}
                    aria-label={`Dodaj do kalendarza systemowego: ${title.trim() || "Bez tytułu"}`}
                    title="Pobierz .ics — dodaj do kalendarza Google, Apple lub Outlook"
                    className="inline-flex items-center justify-center p-2 coarse:min-h-11 coarse:min-w-11 shrink-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  {/* Pominięcie bez wchodzenia w edycję — w wierszu serii, a nie tylko w dialogu (2b planu). */}
                  {onSkip && occ.repeat !== "none" && (
                    <button
                      onClick={() => onSkip(occ)}
                      aria-label={`Pomiń to wystąpienie: ${title.trim() || "Bez tytułu"}`}
                      title="Pomiń to wystąpienie — seria przesunie się na następne"
                      className="inline-flex items-center justify-center p-2 coarse:min-h-11 coarse:min-w-11 shrink-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <SkipForward className="w-3.5 h-3.5" />
                    </button>
                  )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
