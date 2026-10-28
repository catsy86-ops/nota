import { CalendarClock, NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { localDayKey } from "@/lib/dayDone";
import { useShifts, useShiftsReady } from "@/lib/shifts";
import { dayType } from "@/lib/shifts/model";
import { useShiftNow } from "@/lib/shifts/useShiftNow";
import { format, formatDistanceStrict } from "date-fns";
import { pl } from "date-fns/locale";

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
  // G2.1: „trwa teraz” albo „za X” liczone jak w karcie Teraz w Grafiku (ten sam zegar i te same zmiany).
  const { now, current, next } = useShiftNow(data);
  // B3: pasek postępu bieżącej zmiany (0–1), liczony z tego samego zegara co napis.
  const progress = current ? Math.min(1, Math.max(0, (now.getTime() - current.start.getTime()) / (current.end.getTime() - current.start.getTime()))) : null;
  const timing = !ready ? null
    : current ? `Trwa teraz, do ${format(current.end, "HH:mm")}`
    : next ? `Zaczynasz za ${formatDistanceStrict(next.start, now, { locale: pl })}, o ${format(next.start, "HH:mm")}`
    : null;

  let shift: string;
  if (!ready) shift = "Grafik się wczytuje…";
  else if (!entry) shift = "Dziś nie ma zmiany w grafiku.";
  // Godziny wpisane na ten dzień wygrywają z godzinami rodzaju (tak jak w Kalendarzu); nieobecność bez godzin.
  else if (type) {
    const t = dayType(type, entry);
    shift = t.kind === "absence" ? t.name : `${t.name}, ${t.start}–${t.end}`;
  }
  else shift = "Zaplanowana zmiana (rodzaj usunięty).";

  return (
    <section aria-label="Dziś" data-testid="today-card" className="rounded-card border border-border bg-card p-4 sm:p-5">
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
      {timing && <p className="mt-2 text-xs text-muted-foreground tabular-nums" data-testid="today-timing">{timing}</p>}
      {progress !== null && (
        <div role="progressbar" aria-label="Postęp zmiany" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${progress * 100}%` }} data-testid="today-progress" />
        </div>
      )}
    </section>
  );
}
