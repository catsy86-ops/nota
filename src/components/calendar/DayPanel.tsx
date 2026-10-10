import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { CalendarPlus, Plus, Pencil, ArrowRight, Download } from "lucide-react";
import { ReminderChip } from "./ReminderChip";
import type { Occurrence } from "@/lib/reminderOccurrences";
import { shiftInk, shiftLabel, shiftTextOnCard, type ShiftType } from "@/lib/shifts";

/**
 * Lista terminów wybranego dnia — tu mieszczą się pełne tytuły, których
 * komórka siatki nie pomieści, więc to ona jest właściwym „widokiem dnia”.
 * Osi godzinowej świadomie nie ma: przypomnienia mają godzinę, ale nie mają
 * czasu trwania, więc oś rysowałaby punkty, nie bloki — czyli gorszą listę.
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
  onAdd: () => void;
  onEdit: (occurrence: Occurrence) => void;
  /** Shift+←/→ na terminie — klawiaturowy odpowiednik przeciągania (WCAG 2.5.7). */
  onMoveByDays: (occurrence: Occurrence, days: number) => void;
  /** Pobiera `.ics` z tym terminem — kalendarz systemowy przypomni przy zamkniętej aplikacji. */
  onExport: (occurrence: Occurrence) => void;
  /** Klik w prognozę serii — prowadzi do najbliższego, zapisanego terminu. */
  onOpenSeriesSource: (occurrence: Occurrence) => void;
}

export function DayPanel({ day, occurrences, titleOf, shift, onAdd, onEdit, onMoveByDays, onExport, onOpenSeriesSource }: DayPanelProps) {
  return (
    <section aria-label="Terminy wybranego dnia" className="rounded-2xl border border-border/50 bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <h3 aria-live="polite" className="font-display font-semibold text-sm first-letter:uppercase">
          {format(day, "EEEE, d MMMM", { locale: pl })}
        </h3>
        <button
          onClick={onAdd}
          className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary hover:bg-primary/10 px-2 py-1 coarse:min-h-11 coarse:px-3 rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="w-3.5 h-3.5" />
          Dodaj termin
        </button>
      </div>

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
        </p>
      )}

      {occurrences.length === 0 ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <CalendarPlus className="w-4 h-4 shrink-0 text-muted-foreground/70" />
          Brak terminów tego dnia.
        </p>
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
                      className="group w-full flex items-center gap-2 rounded-lg hover:bg-muted/60 transition-colors p-1 -m-1 coarse:min-h-11 outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                    aria-label={`Edytuj termin: ${title.trim() || "Bez tytułu"}`}
                    aria-keyshortcuts="Shift+ArrowLeft Shift+ArrowRight"
                    title="Shift+←/→ — przesuń o dzień"
                    className="group w-full flex items-center gap-2 rounded-lg hover:bg-muted/60 transition-colors p-1 -m-1 coarse:min-h-11 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ReminderChip occurrence={occ} title={title} detailed className="min-w-0 flex-1" />
                    <Pencil className="w-3.5 h-3.5 shrink-0 text-muted-foreground opacity-0 coarse:opacity-100 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity" />
                  </button>
                  <button
                    onClick={() => onExport(occ)}
                    aria-label={`Dodaj do kalendarza systemowego: ${title.trim() || "Bez tytułu"}`}
                    title="Pobierz .ics — dodaj do kalendarza Google, Apple lub Outlook"
                    className="inline-flex items-center justify-center p-2 coarse:min-h-11 coarse:min-w-11 shrink-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
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
