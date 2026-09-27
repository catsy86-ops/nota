import { format, isSameDay, isSameMonth } from "date-fns";
import { pl } from "date-fns/locale";
import { ReminderChip } from "./ReminderChip";
import type { Occurrence } from "@/lib/reminderOccurrences";
import { cn } from "@/lib/utils";

/** Ile chipów mieści się w komórce, zanim reszta zwinie się w „+N". */
const MAX_CHIPS = 3;

function terminy(n: number): string {
  if (n === 1) return "1 termin";
  if (n >= 2 && n <= 4) return `${n} terminy`;
  return `${n} terminów`;
}

interface DayCellProps {
  day: Date;
  month: Date;
  occurrences: Occurrence[];
  titleOf: (noteId: string) => string;
  selected: boolean;
  focused: boolean;
  onSelect: (day: Date) => void;
  cellRef?: (el: HTMLDivElement | null) => void;
}

export function DayCell({ day, month, occurrences, titleOf, selected, focused, onSelect, cellRef }: DayCellProps) {
  const inMonth = isSameMonth(day, month);
  const today = isSameDay(day, new Date());
  const shown = occurrences.slice(0, MAX_CHIPS);
  const hidden = occurrences.length - shown.length;

  const label = `${format(day, "d MMMM yyyy", { locale: pl })}${today ? ", dzisiaj" : ""}, ${
    occurrences.length === 0 ? "brak terminów" : terminy(occurrences.length)
  }`;

  return (
    <div
      ref={cellRef}
      role="gridcell"
      aria-label={label}
      aria-selected={selected}
      // Roving tabindex: cała siatka to jeden przystanek tabulatora, a po
      // dniach chodzi się strzałkami — tak działa natywny date picker.
      tabIndex={focused ? 0 : -1}
      onClick={() => onSelect(day)}
      className={cn(
        "relative flex flex-col gap-0.5 min-h-[4.5rem] sm:min-h-[6rem] p-1 sm:p-1.5 rounded-xl border text-left cursor-pointer transition-colors outline-none",
        "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        inMonth ? "border-border/50 bg-card/40" : "border-transparent bg-transparent text-muted-foreground/50",
        selected && "border-primary/60 bg-primary/5",
      )}
    >
      <span
        className={cn(
          "text-[11px] font-medium tabular-nums w-5 h-5 flex items-center justify-center rounded-full shrink-0",
          today && "bg-primary text-primary-foreground",
          !today && !inMonth && "opacity-60",
        )}
      >
        {format(day, "d")}
      </span>

      {/* Treść terminów jest w `aria-label` komórki, więc dla czytnika ekranu
          te same dane nie powtarzają się drugi raz. */}
      <div aria-hidden className="flex flex-col gap-0.5 overflow-hidden">
        {/* Wąski ekran: same kropki — chipy z tekstem nie mieszczą się w 1/7 szerokości. */}
        <div className="flex gap-0.5 flex-wrap sm:hidden pl-0.5">
          {shown.map((occ) => (
            <span
              key={`${occ.noteId}-${occ.at}`}
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                occ.isSeries && !occ.isNext ? "bg-primary/40" : "bg-primary",
              )}
            />
          ))}
          {hidden > 0 && <span className="text-[9px] leading-none text-muted-foreground">+{hidden}</span>}
        </div>

        <div className="hidden sm:flex sm:flex-col gap-0.5">
          {shown.map((occ) => (
            <ReminderChip key={`${occ.noteId}-${occ.at}`} occurrence={occ} title={titleOf(occ.noteId)} />
          ))}
          {hidden > 0 && (
            <span className="text-[10px] text-muted-foreground pl-1">+{hidden} więcej</span>
          )}
        </div>
      </div>
    </div>
  );
}
