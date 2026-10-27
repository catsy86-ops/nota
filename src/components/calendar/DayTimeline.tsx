import { useEffect, useRef, useState } from "react";
import { ArrowRight, Pencil } from "lucide-react";
import { ReminderChip } from "./ReminderChip";
import type { Occurrence } from "@/lib/reminderOccurrences";
import { carryPieces, clockOf, hourBackground, minutesOfDay, shiftPieces, timelineHours } from "@/lib/dayTimeline";
import type { ShiftType } from "@/lib/shifts";

/**
 * Widok dnia z osią godzin (drugi widok panelu dnia, obok listy).
 *
 * Zmiana z Grafiku ma godziny, więc rysuje się jako pasek w lewej kolumnie — gradient
 * w każdym wierszu, z przerwą jaśniejszą. Przypomnienie to punkt: stoi w swojej godzinie
 * z dokładnym czasem. Terminy „cały dzień” są u góry, bez godziny.
 *
 * Ta sama obsługa co w liście: klik edytuje, Shift+←/→ przesuwa o dzień, prognozę serii
 * otwiera najbliższy zapisany termin.
 */

interface DayTimelineProps {
  /** Dzisiejszy dzień: rysuje linię „teraz” i przewija do niej (K4.4). */
  showNow?: boolean;
  occurrences: Occurrence[];
  titleOf: (noteId: string) => string;
  shift?: ShiftType;
  /** Zmiana z poprzedniego dnia — jej część po północy (nocka) pokazuje się też tutaj (K2.7). */
  prevShift?: ShiftType;
  onEdit: (occurrence: Occurrence) => void;
  onMoveByDays: (occurrence: Occurrence, days: number) => void;
  onOpenSeriesSource: (occurrence: Occurrence) => void;
}

const itemClass = "group w-full flex items-center gap-2 rounded-field hover:bg-muted/60 transition-colors p-0.5 -m-0.5 coarse:min-h-11 outline-hidden focus-visible:ring-2 focus-visible:ring-ring";

function TimelineItem({ occ, title, onEdit, onMoveByDays, onOpenSeriesSource }: {
  occ: Occurrence;
  title: string;
  onEdit: DayTimelineProps["onEdit"];
  onMoveByDays: DayTimelineProps["onMoveByDays"];
  onOpenSeriesSource: DayTimelineProps["onOpenSeriesSource"];
}) {
  const name = title.trim() || "Bez tytułu";
  if (occ.isSeries && !occ.isNext) {
    return (
      <button
        type="button"
        onClick={() => onOpenSeriesSource(occ)}
        aria-label={`Prognoza serii: ${name} — przejdź do najbliższego terminu`}
        className={itemClass}
      >
        <ReminderChip occurrence={occ} title={title} detailed className="min-w-0 flex-1" />
        <ArrowRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground opacity-0 coarse:opacity-100 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity" />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onEdit(occ)}
      onKeyDown={(e) => {
        if (!e.shiftKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
        e.preventDefault();
        onMoveByDays(occ, e.key === "ArrowRight" ? 1 : -1);
      }}
      aria-label={`Edytuj termin: ${name}`}
      aria-keyshortcuts="Shift+ArrowLeft Shift+ArrowRight"
      title="Shift+←/→ — przesuń o dzień"
      className={itemClass}
    >
      <ReminderChip occurrence={occ} title={title} detailed className="min-w-0 flex-1" />
      <Pencil className="w-3.5 h-3.5 shrink-0 text-muted-foreground opacity-0 coarse:opacity-100 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity" />
    </button>
  );
}

const pad = (h: number) => `${String(h).padStart(2, "0")}:00`;

export function DayTimeline({ showNow = false, occurrences, titleOf, shift, prevShift, onEdit, onMoveByDays, onOpenSeriesSource }: DayTimelineProps) {
  const nowRef = useRef<HTMLSpanElement>(null);
  // Linia „teraz” idzie co minutę (K4.4): minutowy sygnał przerysowuje oś tylko dla dzisiejszego dnia.
  const [, setMinuteTick] = useState(0);
  useEffect(() => {
    if (!showNow) return;
    const id = window.setInterval(() => setMinuteTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, [showNow]);
  const nowMin = showNow ? minutesOfDay(Date.now()) : -1;
  useEffect(() => {
    if (!showNow) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    nowRef.current?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  }, [showNow]);
  const pieces = [...shiftPieces(shift), ...carryPieces(prevShift)];
  const allDay = occurrences.filter((o) => o.allDay);
  const timed = occurrences.filter((o) => !o.allDay);
  const { from, to } = timelineHours(pieces, timed.map((o) => minutesOfDay(o.at)));
  const color = shift?.color ?? "transparent";
  const itemProps = { titleOf, onEdit, onMoveByDays, onOpenSeriesSource };

  const hours = Array.from({ length: to - from }, (_, i) => from + i);

  return (
    <div className="space-y-2">
      {allDay.length > 0 && (
        <div className="flex flex-wrap items-start gap-2 pb-2 border-b border-dashed border-border/70">
          <span className="w-10 shrink-0 pt-1 text-2xs text-muted-foreground">Cały dzień</span>
          <ul className="flex-1 min-w-0 space-y-1.5">
            {allDay.map((occ) => (
              <li key={`${occ.noteId}-${occ.at}`}>
                <TimelineItem occ={occ} {...itemProps} title={titleOf(occ.noteId)} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <ol aria-label="Oś godzin dnia" className="rounded-field">
        {hours.map((h) => {
          const here = timed.filter((o) => Math.floor(minutesOfDay(o.at) / 60) === h);
          const bg = hourBackground(pieces, h, color);
          return (
            <li key={h} className="relative flex items-stretch gap-2 min-h-9 border-t border-border/50 first:border-t-0">
              <span className="w-10 shrink-0 pt-1.5 font-mono text-2xs tabular-nums text-muted-foreground">{pad(h)}</span>
              <span aria-hidden className="w-2 shrink-0 rounded-sm" style={bg ? { background: bg } : undefined} />
              <div className="flex-1 min-w-0 py-1 space-y-1.5">
                {/* Przerwa jako znacznik z godzinami, nie tylko jaśniejszy pasek (K2.7). */}
                {pieces.filter((p) => !p.work && Math.floor(p.from / 60) === h).map((p) => (
                  <span key={`break-${p.from}`} className="block text-2xs italic text-muted-foreground">
                    przerwa {clockOf(p.from)}–{clockOf(p.to)}
                  </span>
                ))}
                {here.map((occ) => (
                  <TimelineItem key={`${occ.noteId}-${occ.at}`} occ={occ} {...itemProps} title={titleOf(occ.noteId)} />
                ))}
              </div>
              {nowMin >= 0 && Math.floor(nowMin / 60) === h && (
                <span
                  ref={nowRef}
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 flex items-center"
                  style={{ top: `${((nowMin % 60) / 60) * 100}%` }}
                >
                  <span className="w-10 shrink-0 -translate-y-1/2 pl-0.5 font-mono text-2xs tabular-nums text-[var(--margin)]">{clockOf(nowMin)}</span>
                  <span className="h-px flex-1 bg-[var(--margin)]" />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
