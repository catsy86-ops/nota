import { useMemo } from "react";
import { addDays, format, startOfDay } from "date-fns";
import { pl } from "date-fns/locale";
import { ReminderChip } from "./ReminderChip";
import { expandOccurrences, groupByDay, dayKey } from "@/lib/reminderOccurrences";
import { shiftInk, shiftLabel, shiftTextOnCard, type ShiftType } from "@/lib/shifts";
import { HardHat } from "lucide-react";
import { studySummary, type StudyDayMarks } from "@/lib/study/calendarMarks";
import type { Note } from "@/hooks/useNotes";

/** Ile terminów mieści się w karcie dnia, zanim reszta zwinie się w „+N”. */
const MAX_ITEMS = 3;

interface UpcomingDaysProps {
  notes: Note[];
  titleOf: (noteId: string) => string;
  shiftOf: (key: string) => ShiftType | undefined;
  /** Znaczniki Pracy (K3.1): wizyty i dostawy tego dnia. */
  studyOf?: (key: string) => StudyDayMarks | undefined;
  /** Klik w kartę: kalendarz skacze do tego dnia i pokazuje jego panel. */
  onSelectDay: (day: Date) => void;
}

/**
 * „Co mam dziś i jutro” — zmiana z Grafiku i terminy obu dni w jednym miejscu,
 * niezależnie od tego, który miesiąc jest otwarty w siatce poniżej.
 */
export function UpcomingDays({ notes, titleOf, shiftOf, studyOf, onSelectDay }: UpcomingDaysProps) {
  const today = startOfDay(new Date());
  const todayKey = dayKey(today);
  const days = useMemo(() => [today, addDays(today, 1)], [todayKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const byDay = useMemo(() => {
    const start = days[0].getTime();
    const end = addDays(days[1], 1).getTime() - 1;
    return groupByDay(expandOccurrences(notes, start, end));
  }, [notes, days]);

  return (
    <section aria-label="Dziś i jutro" className="grid grid-cols-2 gap-2">
      {days.map((day, i) => {
        const key = dayKey(day);
        const shift = shiftOf(key);
        const items = byDay.get(key) ?? [];
        const shown = items.slice(0, MAX_ITEMS);
        const absence = shift?.kind === "absence";
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelectDay(day)}
            style={{ "--i": i } as React.CSSProperties}
            className="rise-in min-w-0 text-left rounded-card border border-border/50 bg-card p-2.5 sm:p-3 transition-colors [@media(hover:hover)]:hover:border-primary/40"
          >
            <span className="flex items-baseline gap-2">
              <span className="font-display font-semibold text-sm">{i === 0 ? "Dziś" : "Jutro"}</span>
              <span className="max-sm:hidden text-xs text-muted-foreground">{format(day, "EEEE, d MMMM", { locale: pl })}</span>
              <span className="sm:hidden text-xs text-muted-foreground">{format(day, "EEEEEE d.MM", { locale: pl })}</span>
            </span>
            <span className="mt-2 flex min-w-0 items-center gap-2 text-sm">
              {shift ? (
                <>
                  <span
                    aria-hidden
                    className={`rounded px-1.5 font-display font-bold text-xs leading-5 ${absence ? "border" : ""}`}
                    style={absence
                      ? { borderColor: shift.color, backgroundColor: `color-mix(in srgb, ${shift.color} 16%, transparent)`, color: shiftTextOnCard(shift.color) }
                      : { backgroundColor: shift.color, color: shiftInk(shift.color) }}
                  >
                    {shift.short}
                  </span>
                  <span className="min-w-0 truncate"><span className="sr-only">Zmiana w Grafiku: </span>{shiftLabel(shift)}</span>
                </>
              ) : (
                <span className="text-muted-foreground"><span className="sm:hidden">Bez zmiany</span><span className="max-sm:hidden">Bez zmiany w Grafiku</span></span>
              )}
            </span>
            {(() => { const work = studySummary(studyOf?.(key)); return work ? (
              <span className="mt-1 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                <HardHat className="size-3 shrink-0" aria-hidden />
                <span className="truncate">{work}</span>
              </span>
            ) : null; })()}
            <span className="mt-2 flex flex-col gap-1">
              {items.length === 0 ? (
                <span className="text-xs text-muted-foreground">Brak terminów.</span>
              ) : (
                <>
                  {shown.map((occ, j) => (
                    <ReminderChip key={`${occ.noteId}-${occ.at}`} occurrence={occ} title={titleOf(occ.noteId)} detailed
                      className="chip-slide" style={{ "--i": i + j } as React.CSSProperties} />
                  ))}
                  {items.length > shown.length && (
                    <span className="text-2xs text-muted-foreground pl-1">+{items.length - shown.length} więcej</span>
                  )}
                </>
              )}
            </span>
          </button>
        );
      })}
    </section>
  );
}
