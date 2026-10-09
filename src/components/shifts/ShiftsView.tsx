import { useCallback, useMemo, useState } from "react";
import { addMonths, format, startOfMonth } from "date-fns";
import { pl } from "date-fns/locale";
import { CalendarArrowDown, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { dayKey } from "@/lib/reminderOccurrences";
import { applyPatternToStore, buildShiftsIcs, exportableShiftDays, monthSummary, restoreDays, setDayShift, shiftStore, useShifts, type ShiftType } from "@/lib/shifts";
import { download } from "@/lib/exportNotes";
import { pluralPl } from "@/lib/plural";
import { NowCard } from "./NowCard";
import { BrushBar, type Brush } from "./BrushBar";
import { ShiftMonthGrid } from "./ShiftMonthGrid";
import { ShiftSummary } from "./ShiftSummary";
import { ShiftTypeDialog } from "./ShiftTypeDialog";
import { DayDialog } from "./DayDialog";
import { PatternDialog } from "./PatternDialog";

const navButton = "pressable shrink-0 w-10 h-10 coarse:w-11 coarse:h-11 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Grafik zmian. Widok tylko składa części: stan Grafiku żyje w
 * `lib/shifts/store`, obliczenia w czystych funkcjach `lib/shifts/*`,
 * a tutaj zostaje to, co lokalne dla ekranu — miesiąc, pędzel i otwarte okna.
 */
export function ShiftsView() {
  const data = useShifts();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [brush, setBrush] = useState<Brush>(() => (data.types[0] ? { kind: "type", id: data.types[0].id } : { kind: "inspect" }));
  const [editingType, setEditingType] = useState<ShiftType | "new" | null>(null);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [patternOpen, setPatternOpen] = useState(false);

  const typesById = useMemo(() => new Map(data.types.map((t) => [t.id, t])), [data.types]);
  const summary = useMemo(() => monthSummary(data, month.getFullYear(), month.getMonth()), [data, month]);

  // Stabilna referencja — siatka jest `memo` i nie musi się przerysowywać przy otwieraniu okien.
  const onDay = useCallback((key: string) => {
    if (brush.kind === "inspect") return setOpenDay(key);
    if (brush.kind === "erase") return setDayShift(key, null);
    // Ta sama zmiana drugi raz = zdejmij ją — szybka poprawka bez sięgania po gumkę.
    setDayShift(key, shiftStore.get().days[key]?.type === brush.id ? null : brush.id);
  }, [brush]);

  function applyPattern(steps: (string | null)[], startKey: string, length: number) {
    const before = applyPatternToStore(steps, startKey, length);
    toast.success(`Nałożono cykl na ${length} dni`, {
      action: { label: "Cofnij", onClick: () => restoreDays(before) },
    });
  }

  /** Od oglądanego miesiąca w przód — tyle, ile ktoś zwykle chce mieć w telefonie. */
  function exportIcs() {
    const keys = exportableShiftDays(data, dayKey(month));
    if (keys.length === 0) {
      toast("Brak zmian do eksportu", { description: "Nanieś zmiany w tym lub kolejnych miesiącach." });
      return;
    }
    download(buildShiftsIcs(data, keys), `grafik-${format(month, "yyyy-MM")}.ics`, "text/calendar;charset=utf-8");
    toast.success(`Pobrano ${keys.length} ${pluralPl(keys.length, ["dzień", "dni", "dni"])} grafiku (.ics)`, {
      description: "Otwórz plik, żeby dodać zmiany do kalendarza telefonu. Ponowny import aktualizuje wpisy; dni wyczyszczone w grafiku usuń z kalendarza ręcznie.",
    });
  }

  return (
    <div className="space-y-5">
      <NowCard data={data} />

      <div className="flex items-center justify-between gap-2 sm:justify-center sm:gap-4">
        <button type="button" onClick={() => setMonth((m) => addMonths(m, -1))} aria-label="Poprzedni miesiąc" className={navButton}>
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="min-w-0 sm:min-w-[12rem] text-center">
          <button type="button" onClick={() => setMonth(startOfMonth(new Date()))} title="Wróć do bieżącego miesiąca"
            className="pressable w-full h-10 coarse:h-11 truncate font-display font-bold text-lg capitalize px-3 rounded-xl hover:bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {format(month, "LLLL yyyy", { locale: pl })}
          </button>
        </h2>
        <button type="button" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Następny miesiąc" className={navButton}>
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <BrushBar
        types={data.types}
        brush={brush}
        onBrush={setBrush}
        onEditType={setEditingType}
        onAddType={() => setEditingType("new")}
        onPattern={() => setPatternOpen(true)}
      />

      <ShiftMonthGrid month={month} days={data.days} typesById={typesById} onDay={onDay} />

      <div className="flex justify-end -mt-2">
        <button type="button" onClick={exportIcs}
          className="pressable flex items-center gap-1.5 h-10 coarse:h-11 px-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <CalendarArrowDown className="w-4 h-4" /> Do kalendarza (.ics)
        </button>
      </div>

      <ShiftSummary summary={summary} hourlyRate={data.hourlyRate} overtimeMultiplier={data.overtimeMultiplier} workSystem={data.workSystem} />

      <ShiftTypeDialog
        type={editingType === "new" ? null : editingType}
        open={editingType !== null}
        onOpenChange={(o) => { if (!o) setEditingType(null); }}
        onSaved={(t) => setBrush({ kind: "type", id: t.id })}
        onDeleted={() => setBrush({ kind: "inspect" })}
      />
      <DayDialog dayKey={openDay} entry={openDay ? data.days[openDay] : undefined} types={data.types} onOpenChange={(o) => { if (!o) setOpenDay(null); }} />
      <PatternDialog
        open={patternOpen}
        onOpenChange={setPatternOpen}
        types={data.types}
        patterns={data.patterns}
        defaultStart={dayKey(month)}
        onApply={applyPattern}
      />
    </div>
  );
}
