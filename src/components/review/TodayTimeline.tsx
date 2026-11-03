import { useMemo, useState } from "react";
import { ChevronDown, Clock3 } from "lucide-react";
import type { Note } from "@/hooks/useNotes";
import { DayTimeline } from "@/components/calendar/DayTimeline";
import { expandOccurrences } from "@/lib/reminderOccurrences";
import { noteListTitle } from "@/lib/noteListTitle";
import { localDayKey } from "@/lib/dayDone";
import { useShifts } from "@/lib/shifts";
import { dayType, type ShiftType } from "@/lib/shifts/model";
import { cn } from "@/lib/utils";

/** Stan zwinięcia osi na tym urządzeniu: "1" rozwinięta, "0" zwinięta; brak — domyślnie (telefon zwinięta). */
export const TODAY_TIMELINE_KEY = "kaczy.today.timeline.v1";

function readOpen(): boolean {
  try {
    const v = localStorage.getItem(TODAY_TIMELINE_KEY);
    if (v === "1" || v === "0") return v === "1";
  } catch { /* brak pamięci — domyślnie */ }
  return typeof window !== "undefined" && !window.matchMedia?.("(max-width: 767px)").matches;
}

/**
 * Dziś 2.4: oś dnia pod kartą zmiany — ta sama `DayTimeline` co w Kalendarzu: pasek zmiany (z nocką z wczoraj),
 * terminy w swoich godzinach i linia „teraz”. Zwijana; stan pamięta urządzenie. Klik w termin otwiera notatkę
 * (przesuwanie terminów jest w Kalendarzu). Ładowana leniwie z `TodayCards`.
 */
export function TodayTimeline({ notes, onOpen }: { notes: Note[]; onOpen: (id: string) => void }) {
  const [open, setOpen] = useState(readOpen);
  const shifts = useShifts();
  const today = new Date();
  const key = localDayKey(today);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).getTime();
  // Klucz dnia w zależnościach: o północy oś przelicza się na nowy dzień.
  const occurrences = useMemo(() => expandOccurrences(notes.filter((n) => !n.trashed), start, end), [notes, start, end]);
  const shiftOf = (k: string): ShiftType | undefined => {
    const entry = shifts.days[k];
    const base = entry ? shifts.types.find((t) => t.id === entry.type) : undefined;
    return base ? dayType(base, entry) : undefined;
  };
  const prevKey = localDayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1));
  const shift = shiftOf(key);
  const titles = useMemo(() => new Map(notes.map((n) => [n.id, noteListTitle(n)])), [notes]);

  const toggle = () => {
    setOpen((o) => {
      try { localStorage.setItem(TODAY_TIMELINE_KEY, o ? "0" : "1"); } catch { /* bez pamięci stan żyje do odświeżenia */ }
      return !o;
    });
  };

  return (
    <section aria-label="Oś dnia" data-testid="today-timeline" className="rounded-card border border-border bg-card p-4 sm:p-5">
      <button type="button" onClick={toggle} aria-expanded={open} aria-controls="today-timeline-body"
        className="pressable flex w-full items-center justify-between gap-2 text-left coarse:min-h-11 outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-field">
        <span className="section-label gap-2"><Clock3 className="h-3.5 w-3.5" aria-hidden />Oś dnia
          <span className="font-mono text-xs font-normal tabular-nums text-muted-foreground">{occurrences.length > 0 ? `${occurrences.length} w godzinach` : "bez terminów"}</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform motion-reduce:transition-none", !open && "-rotate-90")} aria-hidden />
      </button>
      {open && (
        <div id="today-timeline-body" className="mt-3 max-h-96 overflow-y-auto scrollbar-thin">
          <DayTimeline
            showNow
            occurrences={occurrences}
            titleOf={(id) => titles.get(id) ?? ""}
            shift={shift}
            prevShift={shiftOf(prevKey)}
            onEdit={(occ) => onOpen(occ.noteId)}
            onMoveByDays={(occ) => onOpen(occ.noteId)}
            onOpenSeriesSource={(occ) => onOpen(occ.noteId)}
          />
        </div>
      )}
    </section>
  );
}
