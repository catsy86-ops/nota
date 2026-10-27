import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { parseDayKey } from "@/lib/week";
import { studySummary, type StudyDayMarks } from "@/lib/study/calendarMarks";
import type { Occurrence } from "@/lib/reminderOccurrences";

/**
 * Agenda miesiąca (K-3, plan Kalendarza 3.4, K3.2): dni z terminami, zmianą albo Pracą, jedno pod drugim,
 * bez pustych dni. Ta sama lista co wydruk (`CalendarPrintList`), ale wiersze są przyciskami — stuknięcie
 * wybiera dzień i pokazuje jego panel; nie przełącza widoku. Działa na telefonie i na komputerze.
 */
export function MonthAgenda({ month, byDay, titleOf, shiftOf, studyOf, onSelectDay }: {
  month: Date;
  byDay: Map<string, Occurrence[]>;
  titleOf: (noteId: string) => string;
  /** Opis zmiany dnia z Grafiku (np. „Ranna 6–14”); brak = dzień bez zmiany. */
  shiftOf?: (key: string) => string | undefined;
  /** Znaczniki Pracy dnia (wizyty, dostawy). */
  studyOf?: (key: string) => StudyDayMarks | undefined;
  onSelectDay: (key: string) => void;
}) {
  const prefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-`;
  const work = (k: string) => studySummary(studyOf?.(k));
  const keys = Array.from(new Set([...byDay.keys(), ...daysWithShift(prefix, shiftOf)]))
    .filter((k) => k.startsWith(prefix) && ((byDay.get(k)?.length ?? 0) > 0 || shiftOf?.(k) || work(k)))
    .sort();

  if (keys.length === 0) return <div aria-label="Agenda miesiąca"><p className="px-1 py-6 text-center text-sm text-muted-foreground">Brak terminów i zmian w tym miesiącu.</p></div>;

  return (
    <div className="space-y-3" aria-label="Agenda miesiąca" role="list">
      {keys.map((k) => {
        const shift = shiftOf?.(k);
        const occ = byDay.get(k) ?? [];
        return (
          <section key={k} role="listitem" aria-label={format(parseDayKey(k), "EEEE, d MMMM", { locale: pl })} className="rounded-card border border-border/70 bg-card p-3">
            <button type="button" onClick={() => onSelectDay(k)} className="pressable flex w-full items-baseline justify-between gap-2 text-left coarse:min-h-11">
              <span className="text-sm font-semibold first-letter:uppercase">{format(parseDayKey(k), "EEEE, d MMMM", { locale: pl })}</span>
              {shift && <span className="shrink-0 text-xs text-muted-foreground">{shift}</span>}
            </button>
            {work(k) && <p className="mt-1 text-xs text-muted-foreground">{work(k)}</p>}
            {occ.length > 0 && (
              <ul className="mt-2 space-y-1">
                {occ.map((o) => (
                  <li key={`${o.noteId}-${o.at}`} className="flex items-baseline gap-2 text-sm">
                    <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{o.allDay ? "cały dzień" : format(new Date(o.at), "HH:mm")}</span>
                    <span className="min-w-0 flex-1 truncate">{titleOf(o.noteId).trim() || "Bez tytułu"}</span>
                    {o.isSeries && !o.isNext && <span className="shrink-0 text-2xs text-muted-foreground">prognoza</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** Dni miesiąca ze zmianą (przeglądamy 31 kluczy, bo `shifts` nie jest listą). */
function daysWithShift(prefix: string, shiftOf?: (key: string) => string | undefined): string[] {
  if (!shiftOf) return [];
  const out: string[] = [];
  for (let d = 1; d <= 31; d++) {
    const k = `${prefix}${String(d).padStart(2, "0")}`;
    if (shiftOf(k)) out.push(k);
  }
  return out;
}
