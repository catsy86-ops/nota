import { useRef } from "react";
import { format, isSameDay } from "date-fns";
import { pl } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { dayKey, type Occurrence } from "@/lib/reminderOccurrences";
import { holidayName, shiftInk, shiftLabel, shiftTextOnCard, type ShiftType } from "@/lib/shifts";
import { addDaysToKey, parseDayKey, weekKeys, weekRangeLabel } from "@/lib/week";
import { cn } from "@/lib/utils";
import { dayCellClass, dayNumberClass } from "./dayCellStyles";
import { pluralPl } from "@/lib/plural";

interface WeekStripProps {
  /** Wybrany dzień — jego tydzień pokazuje pasek. */
  day: Date;
  byDay: Map<string, Occurrence[]>;
  shiftOf: (key: string) => ShiftType | undefined;
  onSelectDay: (day: Date) => void;
}

const terminy = (n: number) => `${n} ${pluralPl(n, ["termin", "terminy", "terminów"])}`;

/**
 * Pasek jednego tygodnia (pn–nd) nad siatką miesiąca: zmiana z Grafiku
 * i liczba terminów każdego dnia, z tym samym wyglądem komórek co w widoku
 * tygodnia w Grafiku. Wybrany dzień jest jedynym przystankiem tabulatora,
 * strzałki ←/→ przechodzą po dniach (też do sąsiedniego tygodnia).
 */
export function WeekStrip({ day, byDay, shiftOf, onSelectDay }: WeekStripProps) {
  const keys = weekKeys(dayKey(day));
  const selectedKey = dayKey(day);
  const today = new Date();
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const focusAfter = useRef<string | null>(null);

  const go = (key: string) => {
    focusAfter.current = key;
    onSelectDay(parseDayKey(key));
  };

  function onKeyDown(e: React.KeyboardEvent) {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    go(addDaysToKey(selectedKey, step));
  }

  return (
    <section aria-label="Ten tydzień" className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <span className="text-xs font-medium text-muted-foreground">{weekRangeLabel(keys[0])}</span>
        <span className="flex items-center">
          <button type="button" onClick={() => go(addDaysToKey(selectedKey, -7))} aria-label="Poprzedni tydzień"
            className="w-9 h-9 coarse:w-11 coarse:h-11 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => go(addDaysToKey(selectedKey, 7))} aria-label="Następny tydzień"
            className="w-9 h-9 coarse:w-11 coarse:h-11 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ChevronRight className="w-4 h-4" />
          </button>
        </span>
      </div>
      <div role="group" aria-label="Dni tygodnia" onKeyDown={onKeyDown} className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {keys.map((key, i) => {
          const d = parseDayKey(key);
          const shift = shiftOf(key);
          const count = byDay.get(key)?.length ?? 0;
          const isToday = isSameDay(d, today);
          const selected = key === selectedKey;
          const holiday = holidayName(key);
          const absence = shift?.kind === "absence";
          const label = [
            format(d, "d MMMM", { locale: pl }),
            format(d, "EEEE", { locale: pl }),
            isToday ? "dziś" : undefined,
            holiday,
            shift ? `zmiana ${shiftLabel(shift)}` : "bez zmiany",
            count ? terminy(count) : "brak terminów",
          ].filter(Boolean).join(", ");
          return (
            <button
              key={key}
              ref={(el) => {
                if (el) refs.current.set(key, el); else refs.current.delete(key);
                if (el && focusAfter.current === key) { focusAfter.current = null; el.focus(); }
              }}
              type="button"
              tabIndex={selected ? 0 : -1}
              aria-pressed={selected}
              aria-label={label}
              onClick={() => onSelectDay(d)}
              className={cn(
                dayCellClass(true, isToday), "flex flex-col items-center gap-0.5 min-h-[3.5rem] coarse:min-h-[3.75rem] py-1 px-0.5",
                selected && "border-primary/60 bg-[color-mix(in_srgb,hsl(var(--primary))_7%,hsl(var(--card)))] dark:border-primary/60 dark:bg-[color-mix(in_srgb,hsl(var(--primary))_12%,hsl(var(--card)))]",
              )}
            >
              <span aria-hidden className={cn("text-2xs uppercase tracking-wider", i >= 5 ? "text-primary/80" : "text-muted-foreground")}>
                {format(d, "EEEEEE", { locale: pl })}
              </span>
              <span aria-hidden className={dayNumberClass({ today: isToday, holiday: !!holiday, inMonth: true })}>{format(d, "d")}</span>
              <span aria-hidden className="flex items-center gap-1 min-h-4">
                {shift && (
                  <span
                    className={cn("rounded px-1 font-display font-bold text-2xs leading-4", absence && "border")}
                    style={absence
                      ? { borderColor: shift.color, backgroundColor: `color-mix(in srgb, ${shift.color} 16%, transparent)`, color: shiftTextOnCard(shift.color) }
                      : { backgroundColor: shift.color, color: shiftInk(shift.color) }}
                  >
                    {shift.short}
                  </span>
                )}
                {count > 0 && <span className="text-2xs font-medium tabular-nums text-primary">{count}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
