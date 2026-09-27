import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { CalendarPlus } from "lucide-react";
import { ReminderChip } from "./ReminderChip";
import type { Occurrence } from "@/lib/reminderOccurrences";

/**
 * Lista terminów wybranego dnia — tu mieszczą się pełne tytuły, których
 * komórka siatki nie pomieści, więc to ona jest właściwym „widokiem dnia”.
 * Osi godzinowej świadomie nie ma: przypomnienia mają godzinę, ale nie mają
 * czasu trwania, więc oś rysowałaby punkty, nie bloki — czyli gorszą listę.
 */

interface DayPanelProps {
  day: Date;
  occurrences: Occurrence[];
  titleOf: (noteId: string) => string;
}

export function DayPanel({ day, occurrences, titleOf }: DayPanelProps) {
  return (
    <section aria-live="polite" className="rounded-2xl border border-border/50 bg-card/40 p-4">
      <h3 className="font-display font-semibold text-sm first-letter:uppercase mb-3">
        {format(day, "EEEE, d MMMM", { locale: pl })}
      </h3>

      {occurrences.length === 0 ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <CalendarPlus className="w-4 h-4 shrink-0 text-muted-foreground/70" />
          Brak terminów tego dnia.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {occurrences.map((occ) => (
            <li key={`${occ.noteId}-${occ.at}`}>
              <ReminderChip occurrence={occ} title={titleOf(occ.noteId)} detailed />
              {occ.isSeries && !occ.isNext && (
                <p className="text-[10px] text-muted-foreground pl-2 mt-0.5">
                  Prognoza serii — zapisany jest tylko najbliższy termin.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
