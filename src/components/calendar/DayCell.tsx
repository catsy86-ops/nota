import { memo, useRef, useState, type CSSProperties } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { HardHat } from "lucide-react";
import { wasJustMoved } from "./movedSignal";
import { format, isSameDay, isSameMonth } from "date-fns";
import { pl } from "date-fns/locale";
import { ReminderChip } from "./ReminderChip";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { isOverdueOccurrence } from "@/lib/dueTerms";
import { dayKey, type Occurrence } from "@/lib/reminderOccurrences";
import { cn } from "@/lib/utils";
import { holidayName } from "@/lib/shifts/holidays";
import { shiftInk, shiftLabel, shiftTextOnCard, type ShiftType } from "@/lib/shifts";
import { dayCellClass, dayNumberClass, holidayDotClass, holidayNameClass } from "./dayCellStyles";
import { pluralPl } from "@/lib/plural";
import { studySummary, type StudyDayMarks } from "@/lib/study/calendarMarks";

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
function DraggableChip({ occurrence, title, preview }: { occurrence: Occurrence; title: string; preview?: string }) {
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
      {/* Podgląd notatki po najechaniu (K3.5). Po dotyku dymek się nie otwiera (`ui/tooltip`). */}
      {preview ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="block">
              <ReminderChip occurrence={occurrence} title={title} nativeTitle={false} />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs whitespace-pre-line text-xs">{preview}</TooltipContent>
        </Tooltip>
      ) : (
        <ReminderChip occurrence={occurrence} title={title} />
      )}
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
  /** Dwuklik i przytrzymanie (K2.4): dodawanie terminu na ten dzień. */
  onActivate?: (day: Date) => void;
  /** Warstwa „Święta” (K3.3): wyłączona = nazwa i kropka świąt znikają. */
  showHolidays?: boolean;
  /** Podgląd notatki po najechaniu na chip (K3.5). */
  previewOf?: (noteId: string) => string | undefined;
  cellRef?: (el: HTMLDivElement | null) => void;
  /** Zmiana z Grafiku w tym dniu (z godzinami dnia), jeśli jest wpisana. */
  shift?: ShiftType;
  /** Wizyty serwisowe i dostawy z Pracy w tym dniu (tylko odczyt). */
  study?: StudyDayMarks;
}

/** Podsumowanie Pracy dla czytnika i tytułu: „2 wizyty, 1 dostawa”; `null`, gdy nic nie ma. */
function DayCellView({ day, month, occurrences, titleOf, selected, focused, onSelect, onActivate, cellRef, shift, study, showHolidays = true, previewOf }: DayCellProps) {
  // K2.4: przytrzymanie na dotyku (500 ms) otwiera dodawanie na ten dzień. Przeciąganie chipa ma pierwszeństwo.
  const pressTimer = useRef<number | null>(null);
  const pressFired = useRef(false);
  const cancelPress = () => {
    if (pressTimer.current !== null) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };
  function onPressStart(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" || !onActivate) return;
    if ((e.target as HTMLElement).closest('[aria-roledescription="draggable"]')) return;
    pressFired.current = false;
    cancelPress();
    pressTimer.current = window.setTimeout(() => {
      pressFired.current = true;
      pressTimer.current = null;
      onActivate(day);
    }, 500);
  }

  const { setNodeRef, isOver } = useDroppable({ id: `day-drop-${dayKey(day)}`, data: { day } });
  const inMonth = isSameMonth(day, month);
  const today = isSameDay(day, new Date());
  const shown = occurrences.slice(0, MAX_CHIPS);
  const hidden = occurrences.length - shown.length;
  const dots = occurrences.slice(0, MAX_DOTS);
  const hiddenDots = occurrences.length - dots.length;

  const holiday = showHolidays ? holidayName(dayKey(day)) : undefined;
  const work = studySummary(study);
  const label = `${format(day, "EEEE, d MMMM yyyy", { locale: pl })}${today ? ", dziś" : ""}${holiday ? `, ${holiday}` : ""}${shift ? `, zmiana: ${shiftLabel(shift)}` : ""}${work ? `, ${work}` : ""}, ${
    occurrences.length === 0 ? "brak terminów" : terminy(occurrences.length)
  }`;

  return (
    <div
      ref={(el) => { setNodeRef(el); cellRef?.(el); }}
      role="gridcell"
      data-day-key={dayKey(day)}
      aria-label={label}
      aria-selected={selected}
      aria-current={today ? "date" : undefined}
      // Roving tabindex: cała siatka to jeden przystanek tabulatora, a po
      // dniach chodzi się strzałkami — tak działa natywny date picker.
      tabIndex={focused ? 0 : -1}
      onClick={() => {
        // Po przytrzymaniu klik z palca nie zmienia zaznaczenia.
        if (pressFired.current) { pressFired.current = false; return; }
        onSelect(day);
      }}
      onDoubleClick={() => onActivate?.(day)}
      onPointerDown={onPressStart}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
      onPointerCancel={cancelPress}
      // K4.5: zaznaczony dzień dostaje wspólną nazwę przejścia — podświetlenie przesuwa się między dniami.
      style={selected ? ({ viewTransitionName: "day-active" } as CSSProperties) : undefined}
      className={cn(
        dayCellClass(inMonth, today), "@container flex flex-col gap-0.5 min-h-14 sm:min-h-24 p-1 sm:p-1.5 cursor-pointer",
        // Pełne tło z domieszką marki (nie przezroczystość) — inaczej prześwituje kratka tła.
        // Warianty `dark:` z linii wyżej są silniejsze od zwykłych klas —
        // bez własnych `dark:` zaznaczenie w ciemnym motywie byłoby niewidoczne.
        selected && "border-primary/60 bg-[color-mix(in_srgb,var(--primary)_7%,var(--card))] dark:border-primary/60 dark:bg-[color-mix(in_srgb,var(--primary)_12%,var(--card))]",
        // Podświetlenie celu wjeżdża płynnie (tło, ramka, obwódka), a zgasza się szybciej.
        "transition-[background-color,border-color,box-shadow] ease-out-soft",
        isOver
          ? "duration-base border-primary bg-[color-mix(in_srgb,var(--primary)_12%,var(--card))] shadow-[0_0_0_3px_color-mix(in srgb, var(--primary) 14%, transparent)] dark:border-primary dark:bg-[color-mix(in_srgb,var(--primary)_18%,var(--card))]"
          : "duration-fast",
      )}
    >
      {/* Numer, święto (kropka na telefonie, nazwa od `sm`) — tak samo jak w Grafiku. */}
      <span className="flex items-center justify-between">
        <span className={dayNumberClass({ today, holiday: !!holiday, inMonth })}>{format(day, "d")}</span>
        <span className="flex items-center gap-1">
          {/* Praca: ikona z liczbą wizyt i dostaw; osobno od terminów notatek (kropki) i zmiany z Grafiku. */}
          {work && (
            <span aria-hidden className={cn("flex items-center gap-0.5 text-2xs leading-4 text-muted-foreground", !inMonth && "opacity-50")} title={work}>
              <HardHat className="size-3" />
              {(study?.service ?? 0) + (study?.delivery ?? 0)}
            </span>
          )}
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
          {holiday && <span aria-hidden className={cn(holidayDotClass(inMonth, true), "mr-0.5")} />}
        </span>
      </span>
      {holiday && <span aria-hidden className={holidayNameClass(inMonth, true)}>{holiday}</span>}
      {shift && <span aria-hidden className="@[7.5rem]:hidden absolute inset-x-0 bottom-0 h-[3px] rounded-b-card" style={{ backgroundColor: shift.color }} />}

      {/* Treść terminów jest w `aria-label` komórki, więc dla czytnika ekranu
          te same dane nie powtarzają się drugi raz. */}
      <div aria-hidden className="flex flex-col gap-0.5 overflow-hidden">
        {/* Wąska komórka (poniżej 7,5 rem, zapytanie kontenerowe): same kropki — chipy z tekstem się nie mieszczą. */}
        <div className="flex items-center gap-1 flex-wrap @[7.5rem]:hidden pl-0.5">
          {dots.map((occ) => (
            <span
              key={`${occ.noteId}-${occ.at}`}
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                // Prognoza serii to pusty krąg, a zapisany termin pełny — różni się kształtem, nie tylko odcieniem.
                // Zaległy: czerwony kwadrat — święto (czerwona kropka) ma kształt koła, więc się nie myli (K1.1).
                occ.isSeries && !occ.isNext ? "bg-transparent ring-1 ring-primary"
                  : isOverdueOccurrence(occ) ? "rounded-[1px] bg-destructive"
                  : "bg-primary",
              )}
            />
          ))}
          {hiddenDots > 0 && (
            <span className="text-2xs leading-none text-muted-foreground">+{hiddenDots}</span>
          )}
        </div>

        <div className="hidden @[7.5rem]:flex @[7.5rem]:flex-col gap-0.5">
          {shown.map((occ) => (
            <DraggableChip key={`${occ.noteId}-${occ.at}`} occurrence={occ} title={titleOf(occ.noteId)} preview={previewOf?.(occ.noteId)} />
          ))}
          {hidden > 0 && (
            <span className="text-2xs text-muted-foreground pl-1">+{hidden} więcej</span>
          )}
        </div>
      </div>
    </div>
  );
}

/** `memo`: zmiana zaznaczenia nie przerysowuje wszystkich komórek siatki (K5.1). Propsy muszą być stabilne — patrz `MonthGrid`. */
export const DayCell = memo(DayCellView);
