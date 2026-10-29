import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { addDays, format, isSameDay } from "date-fns";
import { pl } from "date-fns/locale";
import { ReminderChip } from "./ReminderChip";
import { dayKey, type Occurrence } from "@/lib/reminderOccurrences";
import { carryPieces, clockOf, minutesOfDay, shiftPieces, type TimelinePiece } from "@/lib/dayTimeline";
import { axisPercent, weekAxisHours, type WeekAxisDay } from "@/lib/weekAxis";
import type { ShiftType } from "@/lib/shifts";
import { cn } from "@/lib/utils";

/**
 * Tydzień z osią godzin (K3.6), tylko na dużym ekranie (`xl`). Siedem kolumn, każda z własnym
 * paskiem zmiany z Grafiku i terminami w swojej godzinie. Terminy przeciąga się myszą: w pionie
 * zmienia godzinę (pełne godziny), w poziomie dzień. Każde przeciągnięcie ma „Cofnij” (`moveToHour`).
 * Klik edytuje; Shift+←/→ przesuwa o dzień, jak w liście. Ładowany leniwie, żeby nie dokładać paczki.
 */

const HOUR_PX = 44;
const GUTTER_PX = 48;
/** Przesunięcie, od którego klik jest przeciąganiem, a nie edycją. */
const DRAG_THRESHOLD_PX = 6;
/** Wysokość chipa w kolumnie (px); chipy z tej samej godziny układają się jeden pod drugim. */
const CHIP_PX = 26;

interface WeekTimelineProps {
  /** Poniedziałek tygodnia, który pokazujemy. */
  weekStart: Date;
  byDay: Map<string, Occurrence[]>;
  titleOf: (noteId: string) => string;
  shiftOf: (key: string) => ShiftType | undefined;
  onEdit: (occurrence: Occurrence) => void;
  onOpenSeriesSource: (occurrence: Occurrence) => void;
  onMoveToHour: (occurrence: Occurrence, day: Date, hour: number) => void;
  onSelectDay: (day: Date) => void;
}

interface DragState {
  occ: Occurrence;
  x0: number;
  y0: number;
  moved: boolean;
}

const pad = (h: number) => `${String(h).padStart(2, "0")}:00`;

export function WeekTimeline({ weekStart, byDay, titleOf, shiftOf, onEdit, onOpenSeriesSource, onMoveToHour, onSelectDay }: WeekTimelineProps) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const todayKey = dayKey(Date.now());

  // Linia „teraz” (jak w `DayTimeline`): co minutę, tylko gdy dzisiejszy dzień jest w tym tygodniu.
  const [, setMinuteTick] = useState(0);
  const showsToday = days.some((d) => isSameDay(d, new Date()));
  useEffect(() => {
    if (!showsToday) return;
    const id = window.setInterval(() => setMinuteTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, [showsToday]);

  // Kolumna dnia: paski zmiany (z nocką z poprzedniego dnia), a minuty terminów bez „cały dzień”.
  const columns = days.map((day) => {
    const key = dayKey(day);
    const timed = (byDay.get(key) ?? []).filter((o) => !o.allDay);
    const shift = shiftOf(key);
    const prevShift = shiftOf(dayKey(addDays(day, -1)));
    const pieces: TimelinePiece[] = [...shiftPieces(shift), ...carryPieces(prevShift)];
    return { day, key, shift, pieces, timed, minutes: timed.map((o) => minutesOfDay(o.at)) };
  });
  const axisDays: WeekAxisDay[] = columns.map((c) => ({ pieces: c.pieces, minutes: c.minutes }));
  const { from, to } = weekAxisHours(axisDays);
  const hours = Array.from({ length: to - from }, (_, i) => from + i);
  const bodyHeight = (to - from) * HOUR_PX;
  const nowMin = showsToday ? minutesOfDay(Date.now()) : -1;

  // Przeciąganie: kliknięcie bez ruchu to edycja, przesunięcie powyżej progu to przeniesienie.
  const dragRef = useRef<DragState | null>(null);
  const [offset, setOffset] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const justDragged = useRef(false);

  function chipKey(occ: Occurrence) {
    return `${occ.noteId}-${occ.at}`;
  }

  function onPointerDown(e: ReactPointerEvent<HTMLButtonElement>, occ: Occurrence) {
    if (occ.isSeries && !occ.isNext) return; // prognozy serii nie przeciągamy
    dragRef.current = { occ, x0: e.clientX, y0: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLButtonElement>, occ: Occurrence) {
    const d = dragRef.current;
    if (!d || chipKey(d.occ) !== chipKey(occ)) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    d.moved = true;
    setOffset({ id: chipKey(occ), dx, dy });
  }

  function onPointerUp(e: ReactPointerEvent<HTMLButtonElement>, occ: Occurrence) {
    const d = dragRef.current;
    dragRef.current = null;
    setOffset(null);
    if (!d || chipKey(d.occ) !== chipKey(occ) || !d.moved) return;
    justDragged.current = true;
    // Kolumna pod kursorem wyznacza dzień, a pozycja w kolumnie — godzinę (pełna godzina, od `from`).
    const col = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-week-col]");
    if (!col) return;
    const day = days[Number(col.dataset.weekCol)];
    const rect = col.getBoundingClientRect();
    const slot = Math.min(hours.length - 1, Math.max(0, Math.floor((e.clientY - rect.top) / HOUR_PX)));
    onMoveToHour(occ, day, from + slot);
  }

  return (
    <div className="rounded-card border border-border/60 bg-card overflow-x-auto">
      <div className="grid min-w-[44rem]" style={{ gridTemplateColumns: `${GUTTER_PX}px repeat(7, minmax(0, 1fr))` }}>
        {/* Nagłówki dni: klik ustawia wybrany dzień (panel dnia). */}
        <div />
        {columns.map(({ day, key }) => (
          <button
            key={key}
            type="button"
            onClick={() => onSelectDay(day)}
            aria-label={format(day, "EEEE, d MMMM", { locale: pl })}
            className={cn(
              "border-l border-border/50 px-1 py-2 text-center text-xs outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
              key === todayKey ? "font-semibold text-primary-ink" : "text-muted-foreground",
            )}
          >
            <span className="block uppercase tracking-wide">{format(day, "EEE", { locale: pl })}</span>
            <span className="block font-mono tabular-nums text-sm">{format(day, "d")}</span>
          </button>
        ))}

        {/* Terminy „cały dzień” nad osią. */}
        <div className="px-1 pt-1 text-2xs text-muted-foreground">Cały dzień</div>
        {columns.map(({ key, day }) => {
          const allDay = (byDay.get(key) ?? []).filter((o) => o.allDay);
          return (
            <div key={key} className="border-l border-t border-border/50 p-1 space-y-1 min-h-6">
              {allDay.map((occ) => (
                <button
                  key={chipKey(occ)}
                  type="button"
                  onClick={() => onEdit(occ)}
                  aria-label={`Edytuj termin: ${titleOf(occ.noteId).trim() || "Bez tytułu"}, cały dzień, ${format(day, "d MMMM", { locale: pl })}`}
                  className="w-full text-left"
                >
                  <ReminderChip occurrence={occ} title={titleOf(occ.noteId)} detailed className="w-full" />
                </button>
              ))}
            </div>
          );
        })}

        {/* Oś: godziny z lewej, a w każdej kolumnie pasek zmiany i terminy w swojej godzinie. */}
        <div className="relative" style={{ height: bodyHeight }}>
          {hours.map((h, i) => (
            <span key={h} className="absolute left-1 -translate-y-1/2 font-mono text-2xs tabular-nums text-muted-foreground" style={{ top: i * HOUR_PX }}>
              {pad(h)}
            </span>
          ))}
        </div>
        {columns.map((c, colIndex) => {
          const stacked = new Map<number, number>(); // godzina → ile chipów już stoi w tej godzinie
          return (
            <div
              key={c.key}
              data-week-col={colIndex}
              className="relative border-l border-border/50"
              style={{ height: bodyHeight }}
            >
              {hours.map((h, i) => (
                <span key={h} aria-hidden className="absolute inset-x-0 border-t border-border/40" style={{ top: i * HOUR_PX }} />
              ))}
              {c.pieces.map((p, pi) => {
                const a = Math.max(p.from, from * 60);
                const b = Math.min(p.to, to * 60);
                if (b <= a) return null;
                const color = c.shift?.color ?? "transparent";
                return (
                  <span
                    key={pi}
                    aria-hidden
                    className="absolute inset-x-0.5 rounded-control"
                    style={{
                      top: `${axisPercent(a, from, to)}%`,
                      height: `${((b - a) / ((to - from) * 60)) * 100}%`,
                      background: p.work ? color : `color-mix(in srgb, ${color} 30%, transparent)`,
                      opacity: p.work ? 0.35 : 0.6,
                    }}
                  />
                );
              })}
              {c.timed.map((occ) => {
                const m = minutesOfDay(occ.at);
                const hourIdx = Math.floor(m / 60) - from;
                const n = stacked.get(hourIdx) ?? 0;
                stacked.set(hourIdx, n + 1);
                const top = (m - from * 60) / 60 * HOUR_PX + n * (CHIP_PX + 2);
                const isForecast = occ.isSeries && !occ.isNext;
                const moving = offset?.id === chipKey(occ);
                const name = titleOf(occ.noteId).trim() || "Bez tytułu";
                return (
                  <button
                    key={chipKey(occ)}
                    type="button"
                    style={{
                      top,
                      height: CHIP_PX,
                      transform: moving && offset ? `translate(${offset.dx}px, ${offset.dy}px)` : undefined,
                      zIndex: moving ? 10 : undefined,
                      touchAction: "none",
                      // Przeciągany chip zostaje w DOM swojej kolumny, a wizualnie leci nad inną — bez tego
                      // `elementFromPoint` trafiałby w niego i kolumną byłaby stara. Przechwycenie wskaźnika działa dalej.
                      pointerEvents: moving ? "none" : undefined,
                    }}
                    onPointerDown={(e) => onPointerDown(e, occ)}
                    onPointerMove={(e) => onPointerMove(e, occ)}
                    onPointerUp={(e) => onPointerUp(e, occ)}
                    onPointerCancel={() => { dragRef.current = null; setOffset(null); }}
                    onClick={() => {
                      if (justDragged.current) { justDragged.current = false; return; }
                      if (isForecast) onOpenSeriesSource(occ);
                      else onEdit(occ);
                    }}
                    onKeyDown={(e) => {
                      if (isForecast || !e.shiftKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
                      e.preventDefault();
                      const at = new Date(occ.at);
                      onMoveToHour(occ, addDays(at, e.key === "ArrowRight" ? 1 : -1), at.getHours());
                    }}
                    aria-label={isForecast ? `Prognoza serii: ${name}` : `Edytuj termin: ${name}, ${clockOf(m)}`}
                    aria-keyshortcuts={isForecast ? undefined : "Shift+ArrowLeft Shift+ArrowRight"}
                    title={isForecast ? "Prognoza serii — przejdź do najbliższego terminu" : "Przeciągnij w pionie (godzina) lub w poziomie (dzień). Shift+←/→ — przesuń o dzień"}
                    className={cn(
                      "absolute inset-x-1 z-raised cursor-grab overflow-hidden rounded-field text-left outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                      isForecast && "cursor-pointer opacity-80",
                      moving && "cursor-grabbing shadow-elevation-3",
                    )}
                  >
                    <ReminderChip occurrence={occ} title={titleOf(occ.noteId)} className="w-full h-full" nativeTitle={false} />
                  </button>
                );
              })}
              {nowMin >= 0 && c.key === todayKey && nowMin >= from * 60 && nowMin < to * 60 && (
                <span aria-hidden className="pointer-events-none absolute inset-x-0 flex items-center" style={{ top: `${axisPercent(nowMin, from, to)}%` }}>
                  <span className="h-px flex-1 bg-[var(--margin)]" />
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
