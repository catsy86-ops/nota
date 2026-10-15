import { memo, useEffect, useRef, useState } from "react";
import { format, isSameDay } from "date-fns";
import { pl } from "date-fns/locale";
import { StickyNote } from "lucide-react";
import { dayKey, type Occurrence } from "@/lib/reminderOccurrences";
import { dayKeyCommand, dayType, entryMinutes, formatDuration, formatHoursShort, holidayName, shiftInk, shiftTextOnCard, type DayEntry, type ShiftType } from "@/lib/shifts";
import { addDaysToKey, parseDayKey, weekKeys } from "@/lib/week";
import { cn } from "@/lib/utils";
import { useToday } from "@/hooks/useToday";
import { monthEnterClass, type MonthDirection } from "@/hooks/useMonthDirection";
import { stampKey, useStampedDays } from "@/hooks/useStampedDays";
import { dayCellClass, dayNumberClass } from "@/components/calendar/dayCellStyles";
import { ReminderChip } from "@/components/calendar/ReminderChip";
import { DayDropCell, type DayActions } from "./ShiftDnd";
import { dayAriaLabel, dropOverClass } from "./dayLabel";

/** Ile terminów mieści się w dniu, zanim reszta zwinie się w „+N”. */
const MAX_REMINDERS = 3;

interface ShiftWeekViewProps {
  /** Poniedziałek wyświetlanego tygodnia (klucz dnia). */
  weekStart: string;
  days: Record<string, DayEntry>;
  typesById: Map<string, ShiftType>;
  /** Terminy z Kalendarza pogrupowane w dni — tylko podgląd, bez edycji. */
  remindersByDay: Map<string, Occurrence[]>;
  titleOf: (noteId: string) => string;
  onDay: (dayKey: string) => void;
  /** Strzałką wyszliśmy poza tydzień — podajemy poniedziałek nowego. */
  onWeekChange: (weekStart: string) => void;
  describedBy?: string;
  actions: DayActions;
}

/**
 * Tydzień pn–nd: na telefonie dni jako wiersze, od `sm` jako kolumny. Każdy
 * dzień to jeden przycisk (stuknięcie = pędzel, jak w miesiącu), a terminy
 * z Kalendarza są w nim tylko podglądem. Klawiatura jak w siatce miesiąca:
 * jeden przystanek tabulatora, strzałki po dniach (pion i poziom krokiem
 * jednego dnia), Shift+strzałki przenoszą zmianę, Ctrl+C/V kopiuje wpis.
 */
export const ShiftWeekView = memo(function ShiftWeekView({
  weekStart, days, typesById, remindersByDay, titleOf, onDay, onWeekChange, describedBy, actions,
}: ShiftWeekViewProps) {
  const today = useToday();
  const todayKey = dayKey(today);
  const keys = weekKeys(weekStart);
  const { stamped, cleared } = useStampedDays(`week-${weekStart}`, days, typesById);

  // Kierunek ostatniej zmiany tygodnia — wejście z tej strony, co w miesiącu (stan z poprzedniego renderu).
  const [lastWeek, setLastWeek] = useState<{ start: string; dir: MonthDirection }>({ start: weekStart, dir: 0 });
  let direction = lastWeek.dir;
  if (lastWeek.start !== weekStart) {
    direction = weekStart > lastWeek.start ? 1 : -1;
    setLastWeek({ start: weekStart, dir: direction });
  }

  const [focused, setFocused] = useState<string>(() => (keys.includes(todayKey) ? todayKey : weekStart));
  useEffect(() => {
    setFocused((f) => (weekKeys(weekStart).includes(f) ? f : weekKeys(weekStart).includes(todayKey) ? todayKey : weekStart));
  }, [weekStart, todayKey]);

  const cellRefs = useRef(new Map<string, HTMLButtonElement>());
  const shouldFocus = useRef(false);
  useEffect(() => {
    if (!shouldFocus.current) return;
    shouldFocus.current = false;
    cellRefs.current.get(focused)?.focus();
  }, [focused, weekStart]);

  function move(to: string) {
    shouldFocus.current = true;
    setFocused(to);
    if (!keys.includes(to)) onWeekChange(weekKeys(to)[0]);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const command = dayKeyCommand(e, 1);
    if (command) {
      e.preventDefault();
      if (command.kind === "copyEntry") actions.copyEntry(focused);
      else if (command.kind === "paste") actions.paste(focused);
      else {
        const target = addDaysToKey(focused, command.deltaDays);
        actions.transfer(focused, target, command.mode);
        move(target);
      }
      return;
    }
    const steps: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      move(e.key === "Home" ? keys[0] : keys[6]);
    } else if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      move(addDaysToKey(focused, e.key === "PageUp" ? -7 : 7));
    } else if (steps[e.key] && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      move(addDaysToKey(focused, steps[e.key]));
    }
  }

  const first = parseDayKey(keys[0]);
  const last = parseDayKey(keys[6]);
  const title = `Tydzień ${format(first, "d MMMM", { locale: pl })} – ${format(last, "d MMMM yyyy", { locale: pl })}`;

  return (
    <div role="grid" aria-label={title} aria-describedby={describedBy} className="select-none" onKeyDown={onKeyDown}>
      {/* key = tydzień: nowy tydzień wjeżdża jak nowy miesiąc. */}
      <div key={weekStart} role="row" className={cn("grid grid-cols-1 sm:grid-cols-7 gap-1.5", monthEnterClass(direction))}>
        {keys.map((key, i) => {
          const day = parseDayKey(key);
          const entry = days[key];
          const base = entry && typesById.get(entry.type);
          const type = base && dayType(base, entry);
          const holiday = holidayName(key);
          const isToday = isSameDay(day, today);
          const absence = type?.kind === "absence";
          const occs = remindersByDay.get(key) ?? [];
          const shown = occs.slice(0, MAX_REMINDERS);
          const reminderLabel = occs.length
            ? [`terminy: ${occs.map((o) => `${format(new Date(o.at), "HH:mm")} ${titleOf(o.noteId).trim() || "bez tytułu"}`).join("; ")}`]
            : [];
          const label = dayAriaLabel({ day, today: isToday, holiday, type, entry, extra: reminderLabel });

          return (
            <DayDropCell key={key} dayKey={key} draggable={!!entry}>
              {({ dragRef, dragProps, dragging, over }) => (
                <button
                  ref={(el) => { dragRef(el); if (el) cellRefs.current.set(key, el); else cellRefs.current.delete(key); }}
                  {...dragProps}
                  type="button"
                  tabIndex={key === focused ? 0 : -1}
                  onClick={() => { setFocused(key); onDay(key); }}
                  aria-label={label}
                  aria-current={isToday ? "date" : undefined}
                  className={cn(
                    dayCellClass(true, isToday),
                    "w-full flex flex-row sm:flex-col items-start sm:items-stretch gap-3 sm:gap-1.5 p-2 min-h-14 sm:min-h-44",
                    "[@media(hover:hover)]:hover:border-primary/40",
                    dragging && "opacity-40", over && dropOverClass,
                  )}
                >
                  <span aria-hidden className="flex w-10 shrink-0 flex-col items-center gap-0.5 sm:w-auto sm:flex-row sm:justify-between">
                    <span className={cn("text-2xs uppercase tracking-wider", i >= 5 ? "text-primary-ink/80" : "text-muted-foreground")}>
                      {format(day, "EEEEEE", { locale: pl })}
                    </span>
                    <span className={dayNumberClass({ today: isToday, holiday: !!holiday, inMonth: true })}>{format(day, "d")}</span>
                  </span>

                  <span aria-hidden className="flex min-w-0 flex-1 flex-col gap-1 self-stretch">
                    {holiday && <span className="text-2xs leading-tight text-destructive/80">{holiday}</span>}

                    {!type && cleared.has(key) && (
                      <span className="stamp-out block h-7 rounded-lg" style={{ backgroundColor: cleared.get(key)!.color }} />
                    )}
                    {type && (
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span
                          key={entry ? stampKey(entry) : undefined}
                          className={cn("relative rounded-lg px-2 py-0.5 text-center font-display font-bold text-sm leading-tight", absence ? "border-[1.5px]" : "shadow-sm", stamped.has(key) && "stamp-in")}
                          style={absence
                            ? { borderColor: type.color, backgroundColor: `color-mix(in srgb, ${type.color} 16%, transparent)`, color: shiftTextOnCard(type.color), "--stamp": type.color } as React.CSSProperties
                            : { backgroundColor: type.color, color: shiftInk(type.color), "--stamp": type.color } as React.CSSProperties}
                        >
                          {absence ? type.name : type.short}
                        </span>
                        {!absence && (
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {type.start}–{type.end} · {formatHoursShort(entryMinutes(type, entry))} h
                          </span>
                        )}
                      </span>
                    )}
                    {entry?.extraMin ? (
                      <span className="text-2xs font-medium tabular-nums text-muted-foreground">
                        {entry.extraMin > 0 ? "↑" : "↓"} {formatDuration(Math.abs(entry.extraMin))} {entry.extraMin > 0 ? "dłużej" : "krócej"}
                      </span>
                    ) : null}
                    {entry?.note && (
                      <span className="flex items-start gap-1 text-xs text-muted-foreground">
                        <StickyNote className="w-3 h-3 mt-0.5 shrink-0" />
                        <span className="line-clamp-2 wrap-break-word">{entry.note}</span>
                      </span>
                    )}
                    {shown.map((occ) => (
                      <ReminderChip key={`${occ.noteId}-${occ.at}`} occurrence={occ} title={titleOf(occ.noteId)} />
                    ))}
                    {occs.length > shown.length && (
                      <span className="text-2xs text-muted-foreground pl-1">+{occs.length - shown.length} więcej</span>
                    )}
                  </span>
                </button>
              )}
            </DayDropCell>
          );
        })}
      </div>
    </div>
  );
});
