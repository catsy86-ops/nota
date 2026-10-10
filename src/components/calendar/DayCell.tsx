import { useState } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { wasJustMoved } from "./movedSignal";
import { format, isSameDay, isSameMonth } from "date-fns";
import { pl } from "date-fns/locale";
import { ReminderChip } from "./ReminderChip";
import { dayKey, type Occurrence } from "@/lib/reminderOccurrences";
import { cn } from "@/lib/utils";
import { holidayName } from "@/lib/shifts/holidays";
import { shiftInk, shiftLabel, shiftTextOnCard, type ShiftType } from "@/lib/shifts";
import { dayCellClass, dayNumberClass, holidayDotClass, holidayNameClass } from "./dayCellStyles";
import { pluralPl } from "@/lib/plural";

/** Ile chipów mieści się w komórce, zanim reszta zwinie się w „+N". */
const MAX_CHIPS = 3;
/** Kropka zajmuje ułamek szerokości chipa, więc na telefonie zmieści się ich więcej. */
const MAX_DOTS = 4;

const terminy = (n: number) => `${n} ${pluralPl(n, ["termin", "terminy", "terminów"])}`;

/**
 * Chip, który da się przeciągnąć na inny dzień. Tylko termin zapisany
 * w modelu (jednorazowy albo najbliższy w serii) — prognozy nie istnieją
 * w danych, więc nie ma czego przesuwać.
 */
function DraggableChip({ occurrence, title }: { occurrence: Occurrence; title: string }) {
  const movable = !occurrence.isSeries || occurrence.isNext;
  const [justMoved] = useState(() => wasJustMoved(occurrence.noteId));
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `occ-${occurrence.noteId}`,
    data: { occurrence },
    disabled: !movable,
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      // Klawiatura przesuwa terminy przez Shift+←/→ w panelu dnia, a siatka
      // ma zostać jednym przystankiem tabulatora — chip nie łapie fokusu.
      tabIndex={-1}
      role={undefined}
      // Wzorzec „stan przy pierwszym renderze”: odbicie gra tylko dla chipa, który właśnie przyleciał.
      className={cn(movable && "cursor-grab touch-none", isDragging && "opacity-40", justMoved && "chip-drop")}
    >
      <ReminderChip occurrence={occurrence} title={title} />
    </div>
  );
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
  /** Zmiana z Grafiku w tym dniu (z godzinami dnia), jeśli jest wpisana. */
  shift?: ShiftType;
}

export function DayCell({ day, month, occurrences, titleOf, selected, focused, onSelect, cellRef, shift }: DayCellProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-drop-${dayKey(day)}`, data: { day } });
  const inMonth = isSameMonth(day, month);
  const today = isSameDay(day, new Date());
  const shown = occurrences.slice(0, MAX_CHIPS);
  const hidden = occurrences.length - shown.length;
  const dots = occurrences.slice(0, MAX_DOTS);
  const hiddenDots = occurrences.length - dots.length;

  const holiday = holidayName(dayKey(day));
  const label = `${format(day, "d MMMM yyyy", { locale: pl })}${today ? ", dzisiaj" : ""}${holiday ? `, ${holiday}` : ""}${shift ? `, zmiana: ${shiftLabel(shift)}` : ""}, ${
    occurrences.length === 0 ? "brak terminów" : terminy(occurrences.length)
  }`;

  return (
    <div
      ref={(el) => { setNodeRef(el); cellRef?.(el); }}
      role="gridcell"
      aria-label={label}
      aria-selected={selected}
      // Roving tabindex: cała siatka to jeden przystanek tabulatora, a po
      // dniach chodzi się strzałkami — tak działa natywny date picker.
      tabIndex={focused ? 0 : -1}
      onClick={() => onSelect(day)}
      className={cn(
        dayCellClass(inMonth, today), "flex flex-col gap-0.5 min-h-[3.5rem] sm:min-h-[6rem] p-1 sm:p-1.5 cursor-pointer",
        // Pełne tło z domieszką marki (nie przezroczystość) — inaczej prześwituje kratka tła.
        // Warianty `dark:` z linii wyżej są silniejsze od zwykłych klas —
        // bez własnych `dark:` zaznaczenie w ciemnym motywie byłoby niewidoczne.
        selected && "border-primary/60 bg-[color-mix(in_srgb,hsl(var(--primary))_7%,hsl(var(--card)))] dark:border-primary/60 dark:bg-[color-mix(in_srgb,hsl(var(--primary))_12%,hsl(var(--card)))]",
        // Podświetlenie celu wjeżdża płynnie (tło, ramka, obwódka), a zgasza się szybciej.
        "transition-[background-color,border-color,box-shadow] ease-out-soft",
        isOver
          ? "duration-base border-primary bg-[color-mix(in_srgb,hsl(var(--primary))_12%,hsl(var(--card)))] shadow-[0_0_0_3px_hsl(var(--primary)/0.14)] dark:border-primary dark:bg-[color-mix(in_srgb,hsl(var(--primary))_18%,hsl(var(--card)))]"
          : "duration-fast",
      )}
    >
      {/* Numer, święto (kropka na telefonie, nazwa od `sm`) — tak samo jak w Grafiku. */}
      <span className="flex items-center justify-between">
        <span className={dayNumberClass({ today, holiday: !!holiday, inMonth })}>{format(day, "d")}</span>
        <span className="flex items-center gap-1">
          {/* Ten sam kolor i skrót co w Grafiku; nieobecność jako jasne tło z ramką, tak jak tam. */}
          {shift && (
            <span
              aria-hidden
              className={cn("rounded px-1 font-display font-bold text-2xs leading-4", shift.kind === "absence" && "border", !inMonth && "opacity-50")}
              style={shift.kind === "absence"
                ? { borderColor: shift.color, backgroundColor: `color-mix(in srgb, ${shift.color} 16%, transparent)`, color: shiftTextOnCard(shift.color) }
                : { backgroundColor: shift.color, color: shiftInk(shift.color) }}
            >
              {shift.short}
            </span>
          )}
          {holiday && <span aria-hidden className={cn(holidayDotClass(inMonth), "mr-0.5")} />}
        </span>
      </span>
      {holiday && <span aria-hidden className={holidayNameClass(inMonth)}>{holiday}</span>}

      {/* Treść terminów jest w `aria-label` komórki, więc dla czytnika ekranu
          te same dane nie powtarzają się drugi raz. */}
      <div aria-hidden className="flex flex-col gap-0.5 overflow-hidden">
        {/* Wąski ekran: same kropki — chipy z tekstem nie mieszczą się w 1/7 szerokości. */}
        <div className="flex items-center gap-1 flex-wrap sm:hidden pl-0.5">
          {dots.map((occ) => (
            <span
              key={`${occ.noteId}-${occ.at}`}
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                occ.isSeries && !occ.isNext ? "bg-primary/40" : "bg-primary",
              )}
            />
          ))}
          {hiddenDots > 0 && (
            <span className="text-2xs leading-none text-muted-foreground">+{hiddenDots}</span>
          )}
        </div>

        <div className="hidden sm:flex sm:flex-col gap-0.5">
          {shown.map((occ) => (
            <DraggableChip key={`${occ.noteId}-${occ.at}`} occurrence={occ} title={titleOf(occ.noteId)} />
          ))}
          {hidden > 0 && (
            <span className="text-2xs text-muted-foreground pl-1">+{hidden} więcej</span>
          )}
        </div>
      </div>
    </div>
  );
}
