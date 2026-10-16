import { CalendarClock, NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { localDayKey } from "@/lib/dayDone";
import { useShifts, useShiftsReady } from "@/lib/shifts";

/**
 * Pierwsza rzecz w widoku „Dziś”: dzisiejsza zmiana z Grafiku (albo „wolne”), obok skrótów
 * do Grafiku i notatki dnia. Dane z Grafiku są tylko do odczytu — zmiany robi się w Grafiku.
 */
export function TodayShiftCard({ onOpenShifts, onDailyNote }: { onOpenShifts: () => void; onDailyNote: () => void }) {
  const ready = useShiftsReady();
  const data = useShifts();
  const today = new Date();
  const dateLabel = today.toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" });
  const entry = ready ? data.days[localDayKey(today)] : undefined;
  const type = entry ? data.types.find((t) => t.id === entry.type) : undefined;

  let shift: string;
  if (!ready) shift = "Grafik się wczytuje…";
  else if (!entry) shift = "Dziś nie ma zmiany w grafiku.";
  else if (type) shift = `${type.name}, ${type.start}–${type.end}`;
  else shift = "Zaplanowana zmiana (rodzaj usunięty).";

  return (
    <section aria-label="Dziś" data-testid="today-card" className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{dateLabel}</p>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 text-sm sm:text-base" data-testid="today-shift">
          <CalendarClock className="mr-1.5 inline h-4 w-4 align-[-2px] text-muted-foreground" aria-hidden />
          {shift}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onOpenShifts} className="coarse:h-11">
            <CalendarClock className="mr-1.5 h-4 w-4" aria-hidden />Grafik
          </Button>
          <Button variant="outline" size="sm" onClick={onDailyNote} className="coarse:h-11">
            <NotebookPen className="mr-1.5 h-4 w-4" aria-hidden />Notatka dnia
          </Button>
        </div>
      </div>
    </section>
  );
}
