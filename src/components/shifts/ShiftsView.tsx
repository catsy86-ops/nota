import { TAP } from "@/lib/platform";
import { useCallback, useMemo, useState } from "react";
import { addMonths, format, startOfMonth } from "date-fns";
import { pl } from "date-fns/locale";
import { CalendarArrowDown, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { dayKey } from "@/lib/reminderOccurrences";
import { DEFAULT_SHIFT_TYPES, addDefaultShiftTypes, SHIFTS_EXPORTED_KEY, applyPatternToStore, buildShiftsIcs, cancelledShiftDays, exportableShiftDays, exportedAfter, monthSummary, restoreDays, setDayEntry, setDayShift, shiftStore, useShifts, useShiftsReady, type ShiftType } from "@/lib/shifts";
import { download } from "@/lib/exportNotes";
import { createPersistedStore } from "@/lib/persistedStore";
import { pluralPl } from "@/lib/plural";
import { toastWithUndo } from "@/lib/undoToast";
import { NowCard } from "./NowCard";
import { BrushBar, type Brush } from "./BrushBar";
import { ShiftMonthGrid } from "./ShiftMonthGrid";
import { ShiftSummary } from "./ShiftSummary";
import { ShiftSettingsDialog } from "./ShiftSettingsDialog";
import { ShiftTypeDialog } from "./ShiftTypeDialog";
import { DayDialog } from "./DayDialog";
import { PatternDialog } from "./PatternDialog";

/** Co zrobi stuknięcie w dzień — widoczne pod paskiem i czytane przy siatce. */
function brushHint(brush: Brush, typesById: Map<string, ShiftType>): string {
  if (brush.kind === "inspect") return `${TAP} dzień, żeby zobaczyć i edytować szczegóły.`;
  if (brush.kind === "erase") return `${TAP} dzień, żeby go wyczyścić.`;
  const name = typesById.get(brush.id)?.name ?? "zmianę";
  return `${TAP} dzień, żeby nanieść: ${name}. Ponownie — zdejmuje.`;
}

const exportedStore = createPersistedStore<string[]>(SHIFTS_EXPORTED_KEY, [], {
  merge: (defaults, stored) => (Array.isArray(stored) ? stored.filter((k): k is string => typeof k === "string") : defaults),
});

const navButton = "pressable shrink-0 w-10 h-10 coarse:w-11 coarse:h-11 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Grafik zmian. Widok tylko składa części: stan Grafiku żyje w
 * `lib/shifts/store`, obliczenia w czystych funkcjach `lib/shifts/*`,
 * a tutaj zostaje to, co lokalne dla ekranu — miesiąc, pędzel i otwarte okna.
 */
export function ShiftsView() {
  // Do wczytania dokumentu nic — pusty grafik mignąłby i ustawił zły pędzel startowy.
  return useShiftsReady() ? <ShiftsScreen /> : null;
}

function ShiftsScreen() {
  const data = useShifts();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [brush, setBrush] = useState<Brush>(() => (data.types[0] ? { kind: "type", id: data.types[0].id } : { kind: "inspect" }));
  const [editingType, setEditingType] = useState<ShiftType | "new" | null>(null);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [patternOpen, setPatternOpen] = useState(false);

  const typesById = useMemo(() => new Map(data.types.map((t) => [t.id, t])), [data.types]);
  const summary = useMemo(() => monthSummary(data, month.getFullYear(), month.getMonth()), [data, month]);

  // Stabilna referencja — siatka jest `memo` i nie musi się przerysowywać przy otwieraniu okien.
  const onDay = useCallback((key: string) => {
    if (brush.kind === "inspect") return setOpenDay(key);
    const entry = shiftStore.get().days[key];
    // Ta sama zmiana drugi raz = zdejmij ją — szybka poprawka bez sięgania po gumkę.
    const clear = brush.kind === "erase" || entry?.type === brush.id;
    setDayShift(key, clear ? null : brush.id);
    // Notatki i odchylenia nie da się odtworzyć jednym stuknięciem — stąd „Cofnij”.
    if (clear && entry && (entry.note || entry.extraMin)) {
      const [y, m, d] = key.split("-").map(Number);
      toastWithUndo(`Wyczyszczono ${format(new Date(y, m - 1, d), "d MMMM", { locale: pl })}`, () => setDayEntry(key, entry), {
        description: entry.note ? `Razem z notatką „${entry.note}”` : "Razem z odchyleniem od planu",
      });
    }
  }, [brush]);

  function applyPattern(steps: (string | null)[], startKey: string, length: number) {
    const before = applyPatternToStore(steps, startKey, length);
    toast.success(`Nałożono cykl na ${length} ${pluralPl(length, ["dzień", "dni", "dni"])}`, {
      action: { label: "Cofnij", onClick: () => restoreDays(before) },
    });
  }

  /**
   * Od oglądanego miesiąca w przód — tyle, ile ktoś zwykle chce mieć w telefonie.
   * Dni wysłane wcześniej, a teraz wyczyszczone, idą jako odwołane.
   */
  function exportIcs() {
    const from = dayKey(month);
    const keys = exportableShiftDays(data, from);
    const cancelled = cancelledShiftDays(data, exportedStore.get(), from);
    if (keys.length === 0 && cancelled.length === 0) {
      toast("Brak zmian do eksportu", { description: "Nanieś zmiany w tym lub kolejnych miesiącach." });
      return;
    }
    download(buildShiftsIcs(data, keys, { cancelled }), `grafik-${format(month, "yyyy-MM")}.ics`, "text/calendar;charset=utf-8");
    exportedStore.set(exportedAfter(exportedStore.get(), keys, from));
    const removed = cancelled.length ? ` Odwołuje ${cancelled.length} ${pluralPl(cancelled.length, ["wyczyszczony dzień", "wyczyszczone dni", "wyczyszczonych dni"])}.` : "";
    toast.success(`Pobrano ${keys.length} ${pluralPl(keys.length, ["dzień", "dni", "dni"])} grafiku (.ics)`, {
      description: `Otwórz plik, żeby dodać zmiany do kalendarza telefonu. Ponowny import aktualizuje wpisy.${removed}`,
    });
  }

  return (
    <div className="space-y-5">
      <NowCard data={data} />

      <div className="flex items-center justify-between gap-2 sm:justify-center sm:gap-4">
        <button type="button" onClick={() => setMonth((m) => addMonths(m, -1))} aria-label="Poprzedni miesiąc" className={navButton}>
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="min-w-0 sm:min-w-[12rem] text-center" aria-live="polite">
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

      {data.types.length === 0 && (
        <section aria-label="Brak rodzajów zmian" className="rounded-3xl border border-dashed border-border p-4 space-y-3">
          <p className="text-sm">
            <span className="font-display font-bold">Nie ma żadnego rodzaju zmiany.</span>{" "}
            <span className="text-muted-foreground">Dodaj własny albo przywróć startowe ({DEFAULT_SHIFT_TYPES.map((t) => t.name).join(", ")}), żeby nanosić je na dni.</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setEditingType("new")}
              className="pressable h-10 coarse:h-11 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Dodaj rodzaj zmiany
            </button>
            <button type="button" onClick={() => { addDefaultShiftTypes(); setBrush({ kind: "type", id: DEFAULT_SHIFT_TYPES[0].id }); }}
              className="pressable h-10 coarse:h-11 px-4 rounded-xl border border-border/60 hover:bg-muted text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Przywróć startowe
            </button>
          </div>
        </section>
      )}

      <p id="shift-brush-hint" className="-mt-3 text-xs text-muted-foreground px-1">{brushHint(brush, typesById)}</p>

      <ShiftMonthGrid month={month} days={data.days} typesById={typesById} onDay={onDay} onMonthChange={setMonth} describedBy="shift-brush-hint" />

      <div className="flex justify-end -mt-2">
        <button type="button" onClick={exportIcs}
          className="pressable flex items-center gap-1.5 h-10 coarse:h-11 px-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <CalendarArrowDown className="w-4 h-4" /> Do kalendarza (.ics)
        </button>
      </div>

      <ShiftSummary summary={summary} hourlyRate={data.hourlyRate} workSystem={data.workSystem} settlementMonths={data.settlementMonths} fte={data.fte} onOpenSettings={() => setSettingsOpen(true)} />
      <ShiftSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} settings={data} />

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
