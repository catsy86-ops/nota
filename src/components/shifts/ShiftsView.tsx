import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDayClock } from "@/lib/dayClock";
import { addMonths, format, isSameMonth, startOfMonth } from "date-fns";
import { pl } from "date-fns/locale";
import { CalendarArrowDown, CalendarRange, FileSpreadsheet, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { dayKey, expandOccurrences, groupByDay, type Occurrence } from "@/lib/reminderOccurrences";
import type { Note } from "@/hooks/useNotes";
import { addDaysToKey, parseDayKey, startOfWeekKey, weekRangeLabel } from "@/lib/week";
import { DEFAULT_SHIFT_TYPES, addDefaultShiftTypes, SHIFTS_EXPORTED_KEY, applyPatternToStore, buildShiftsIcs, buildTimesheetCsv, cancelledShiftDays, copyWeekToNext, exportableShiftDays, exportedAfter, monthSummary, pasteDay, planWeekCopy, restoreDays, setDayEntry, setDayShift, shiftHours, shiftStore, subscribeShiftDay, takeShiftDay, transferDay, useShifts, useShiftsReady, type DayEntry, type ShiftHours, type ShiftType, type TransferMode, type WeekCopyPlan } from "@/lib/shifts";
import { download } from "@/lib/exportNotes";
import { IS_TOUCH, TAP, modShortcut } from "@/lib/platform";
import { createPersistedStore } from "@/lib/persistedStore";
import { pluralPl } from "@/lib/plural";
import { toastWithUndo } from "@/lib/undoToast";
import { NowCard } from "./NowCard";
import { BrushBar, type Brush } from "./BrushBar";
import { BrushHours } from "./BrushHours";
import { ShiftMonthGrid } from "./ShiftMonthGrid";
import { ShiftWeekView } from "./ShiftWeekView";
import { ShiftDnd, type DayActions, type DropMode } from "./ShiftDnd";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ShiftSummary } from "./ShiftSummary";
import { ShiftSettingsDialog } from "./ShiftSettingsDialog";
import { ShiftTypeDialog } from "./ShiftTypeDialog";
import { DayDialog } from "./DayDialog";
import { PatternDialog } from "./PatternDialog";

/** Co zrobi stuknięcie w dzień — widoczne pod paskiem i czytane przy siatce. */
function brushHint(brush: Brush, typesById: Map<string, ShiftType>, hours: ShiftHours | null): string {
  if (brush.kind === "inspect") return `${TAP} dzień, żeby zobaczyć i edytować szczegóły.`;
  if (brush.kind === "erase") return `${TAP} dzień, żeby go wyczyścić.`;
  const name = typesById.get(brush.id)?.name ?? "zmianę";
  return `${TAP} dzień, żeby nanieść: ${name}${hours ? ` ${hours.start}–${hours.end}` : ""}. Ponownie — zdejmuje.`;
}

const exportedStore = createPersistedStore<string[]>(SHIFTS_EXPORTED_KEY, [], {
  merge: (defaults, stored) => (Array.isArray(stored) ? stored.filter((k): k is string => typeof k === "string") : defaults),
});

type ShiftsLayout = "month" | "week";

/** Który widok Grafiku — miesiąc czy tydzień — pamiętany między wizytami. */
const layoutStore = createPersistedStore<ShiftsLayout>("kaczy.shifts.layout.v1", "month", {
  merge: (defaults, stored) => (stored === "week" || stored === "month" ? stored : defaults),
});

const NO_REMINDERS = new Map<string, Occurrence[]>();

const shortDate = (key: string) => format(parseDayKey(key), "d MMM", { locale: pl });

const navButton = "pressable shrink-0 w-10 h-10 coarse:w-11 coarse:h-11 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Grafik zmian. Widok tylko składa części: stan Grafiku żyje w
 * `lib/shifts/store`, obliczenia w czystych funkcjach `lib/shifts/*`,
 * a tutaj zostaje to, co lokalne dla ekranu — miesiąc, pędzel i otwarte okna.
 */
const MOVE_HINT_KEY = "kaczy.shifts.moveHint.v1";

export function ShiftsView({ notes = [] }: { notes?: Note[] }) {
  // Do wczytania dokumentu nic — pusty grafik mignąłby i ustawił zły pędzel startowy.
  return useShiftsReady() ? <ShiftsScreen notes={notes} /> : null;
}

function ShiftsScreen({ notes }: { notes: Note[] }) {
  const data = useShifts();
  const layout = layoutStore.use();
  // `thisWeek` i „Dziś” liczone przy renderze — zegar dnia przerysowuje po północy.
  useDayClock();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [weekStart, setWeekStart] = useState(() => startOfWeekKey(dayKey(new Date())));
  const [clip, setClip] = useState<DayEntry | null>(null);
  const clipRef = useRef<DayEntry | null>(null);
  const [asking, setAsking] = useState<{ from: string; to: string } | null>(null);
  const [confirmCopy, setConfirmCopy] = useState<WeekCopyPlan | null>(null);
  const [brush, setBrush] = useState<Brush>(() => (data.types[0] ? { kind: "type", id: data.types[0].id } : { kind: "inspect" }));
  // Podpowiedź o przeciąganiu zmian zajmowała miejsce nad siatką przy każdym wejściu — raz wystarczy.
  const [moveHintSeen, setMoveHintSeen] = useState(() => { try { return localStorage.getItem(MOVE_HINT_KEY) === "1"; } catch { return false; } });
  const dismissMoveHint = () => { setMoveHintSeen(true); try { localStorage.setItem(MOVE_HINT_KEY, "1"); } catch { /* bez pamięci — tylko na tę sesję */ } };
  // Własne godziny pędzla — przypięte do rodzaju, więc zmiana pędzla je odpina.
  const [brushHours, setBrushHours] = useState<{ typeId: string; hours: ShiftHours } | null>(null);
  const activeHours = brush.kind === "type" && brushHours?.typeId === brush.id ? brushHours.hours : null;
  // Komunikat dla czytnika ekranu: stuknięcie pędzlem zmienia wpis bez żadnego dymka.
  const [announce, setAnnounce] = useState("");
  const [editingType, setEditingType] = useState<ShiftType | "new" | null>(null);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [patternOpen, setPatternOpen] = useState(false);

  // „Pokaż dzień” z palety poleceń: miesiąc tego dnia i jego okno. Prośba mogła
  // przyjść przed załadowaniem widoku, więc odbieramy ją też przy montowaniu.
  useEffect(() => {
    const take = () => {
      const key = takeShiftDay();
      if (!key) return;
      const [y, m] = key.split("-").map(Number);
      setMonth(new Date(y, m - 1, 1));
      setWeekStart(startOfWeekKey(key));
      setOpenDay(key);
    };
    take();
    return subscribeShiftDay(take);
  }, []);

  const typesById = useMemo(() => new Map(data.types.map((t) => [t.id, t])), [data.types]);
  const isWeek = layout === "week";
  // W tygodniu podsumowanie dotyczy miesiąca, w którym tydzień leży głównie (czwartek).
  const shownMonth = useMemo(() => (isWeek ? startOfMonth(parseDayKey(addDaysToKey(weekStart, 3))) : month), [isWeek, weekStart, month]);
  const summary = useMemo(() => monthSummary(data, shownMonth.getFullYear(), shownMonth.getMonth()), [data, shownMonth]);

  const titleOf = useMemo(() => {
    const titles = new Map(notes.map((n) => [n.id, n.locked ? "Notatka prywatna" : n.title || n.content.slice(0, 40)]));
    return (id: string) => titles.get(id) ?? "";
  }, [notes]);
  // Terminy z Kalendarza — tylko podgląd w widoku tygodnia.
  const remindersByDay = useMemo(() => {
    if (!isWeek) return NO_REMINDERS;
    const start = parseDayKey(weekStart).getTime();
    const end = parseDayKey(addDaysToKey(weekStart, 7)).getTime() - 1;
    return groupByDay(expandOccurrences(notes, start, end));
  }, [isWeek, notes, weekStart]);

  function setLayout(next: ShiftsLayout) {
    if (next === layout) return;
    if (next === "week") {
      const today = new Date();
      setWeekStart(startOfWeekKey(isSameMonth(today, month) ? dayKey(today) : dayKey(month)));
    } else {
      setMonth(startOfMonth(parseDayKey(addDaysToKey(weekStart, 3))));
    }
    layoutStore.set(next);
  }

  const thisWeek = startOfWeekKey(dayKey(new Date()));

  // Stabilna referencja — siatka jest `memo` i nie musi się przerysowywać przy otwieraniu okien.
  const onDay = useCallback((key: string) => {
    if (brush.kind === "inspect") return setOpenDay(key);
    const entry = shiftStore.get().days[key];
    // Ta sama zmiana drugi raz = zdejmij ją — szybka poprawka bez sięgania po gumkę.
    if (brush.kind === "type" && activeHours) {
      const h = shiftHours(activeHours);
      const same = entry?.type === brush.id && entry.customHours && entry.hours
        && entry.hours.start === h.start && entry.hours.end === h.end && entry.hours.breakMin === h.breakMin;
      if (same) { setDayShift(key, null); return; }
      setDayEntry(key, { type: brush.id, ...(entry?.note ? { note: entry.note } : {}), hours: h, customHours: true });
      setAnnounce(`${shortDate(key)}: ${typesById.get(brush.id)?.name ?? "zmiana"} ${h.start}–${h.end}`);
      return;
    }
    const clear = brush.kind === "erase" || entry?.type === brush.id;
    setDayShift(key, clear ? null : brush.id);
    setAnnounce(clear ? `${shortDate(key)}: wyczyszczono` : `${shortDate(key)}: ${typesById.get(brush.id)?.name ?? "zmiana"}`);
    // Notatki i odchylenia nie da się odtworzyć jednym stuknięciem — stąd „Cofnij”.
    if (clear && entry && (entry.note || entry.extraMin)) {
      const [y, m, d] = key.split("-").map(Number);
      toastWithUndo(`Wyczyszczono ${format(new Date(y, m - 1, d), "d MMMM", { locale: pl })}`, () => setDayEntry(key, entry), {
        description: entry.note ? `Razem z notatką „${entry.note}”` : "Razem z odchyleniem od planu",
      });
    }
  }, [brush, activeHours, typesById]);

  // Przenoszenie i kopiowanie wpisów — jedna ścieżka dla myszy, dotyku i klawiatury.
  const transfer = useCallback((from: string, to: string, mode: TransferMode) => {
    const days = shiftStore.get().days;
    const src = days[from];
    if (!src) { toast("Ten dzień nie ma zmiany", { description: "Nie ma czego przenosić ani kopiować." }); return; }
    const replaced = !!days[to];
    const before = transferDay(from, to, mode, dayKey(new Date()));
    if (!before) { toast("Bez zmian", { description: "W dniu docelowym jest już taki sam wpis." }); return; }
    const name = shiftStore.get().types.find((t) => t.id === src.type)?.name ?? "Zmiana";
    toastWithUndo(`${mode === "move" ? "Przeniesiono" : "Skopiowano"} ${name}: ${shortDate(from)} → ${shortDate(to)}`, () => restoreDays(before), {
      description: replaced ? "Zastąpiono wpis w dniu docelowym" : undefined,
    });
  }, []);

  const actions = useMemo<DayActions>(() => ({
    transfer,
    copyEntry: (key) => {
      const entry = shiftStore.get().days[key];
      if (!entry) { toast("Ten dzień nie ma zmiany do skopiowania"); return; }
      clipRef.current = entry;
      setClip(entry);
      const name = shiftStore.get().types.find((t) => t.id === entry.type)?.name ?? "Zmiana";
      toast(`Skopiowano wpis: ${name}, ${shortDate(key)}`, { description: `${modShortcut("V")} na innym dniu go wklei.` });
    },
    paste: (key) => {
      const entry = clipRef.current;
      if (!entry) { toast("Schowek jest pusty", { description: `Na dniu ze zmianą naciśnij ${modShortcut("C")}.` }); return; }
      const before = pasteDay(entry, key, dayKey(new Date()));
      if (!before) { toast("Bez zmian", { description: "Ten dzień ma już taki wpis." }); return; }
      const name = shiftStore.get().types.find((t) => t.id === entry.type)?.name ?? "Zmiana";
      toastWithUndo(`Wklejono ${name}: ${shortDate(key)}`, () => restoreDays(before));
    },
  }), [transfer]);

  const onDrop = useCallback((from: string, to: string, mode: DropMode) => {
    if (mode === "ask") setAsking({ from, to });
    else transfer(from, to, mode);
  }, [transfer]);

  function copyWeek() {
    const plan = planWeekCopy(shiftStore.get().days, weekStart, dayKey(new Date()));
    if (plan.copied === 0) {
      toast("Nie ma czego kopiować", { description: "Ten tydzień nie ma zmian albo następny ma już takie same." });
      return;
    }
    if (plan.overwritten > 0) setConfirmCopy(plan);
    else runCopyWeek();
  }

  function runCopyWeek() {
    const done = copyWeekToNext(weekStart, dayKey(new Date()));
    setConfirmCopy(null);
    if (!done) return;
    const n = done.plan.copied;
    toastWithUndo(`Skopiowano tydzień na następny (${n} ${pluralPl(n, ["dzień", "dni", "dni"])})`, () => restoreDays(done.before), {
      description: done.plan.overwritten ? `Zastąpiono ${done.plan.overwritten} ${pluralPl(done.plan.overwritten, ["wpis", "wpisy", "wpisów"])}` : undefined,
    });
  }

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
    const from = dayKey(shownMonth);
    const keys = exportableShiftDays(data, from);
    const cancelled = cancelledShiftDays(data, exportedStore.get(), from);
    if (keys.length === 0 && cancelled.length === 0) {
      toast("Brak zmian do eksportu", { description: "Nanieś zmiany w tym lub kolejnych miesiącach." });
      return;
    }
    download(buildShiftsIcs(data, keys, { cancelled }), `grafik-${format(shownMonth, "yyyy-MM")}.ics`, "text/calendar;charset=utf-8");
    exportedStore.set(exportedAfter(exportedStore.get(), keys, from));
    const removed = cancelled.length ? ` Odwołuje ${cancelled.length} ${pluralPl(cancelled.length, ["wyczyszczony dzień", "wyczyszczone dni", "wyczyszczonych dni"])}.` : "";
    toast.success(`Pobrano ${keys.length} ${pluralPl(keys.length, ["dzień", "dni", "dni"])} grafiku (.ics)`, {
      description: `Otwórz plik, żeby dodać zmiany do kalendarza telefonu. Ponowny import aktualizuje wpisy.${removed}`,
    });
  }

  function exportCsv() {
    const csv = buildTimesheetCsv(data, shownMonth.getFullYear(), shownMonth.getMonth());
    download(csv, `karta-czasu-${format(shownMonth, "yyyy-MM")}.csv`, "text/csv;charset=utf-8");
    toast.success("Pobrano kartę czasu (.csv)", { description: "Otwórz ją w Excelu lub Arkuszach Google." });
  }

  return (
    <div className="space-y-5">
      <NowCard data={data} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Widok Grafiku" className="flex rounded-xl bg-muted p-0.5">
          {([["month", "Miesiąc"], ["week", "Tydzień"]] as const).map(([id, text]) => (
            <button key={id} type="button" aria-pressed={layout === id} onClick={() => setLayout(id)}
              className={cn(
                "pressable h-9 coarse:h-10 px-3.5 rounded-[0.65rem] text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
                layout === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}>
              {text}
            </button>
          ))}
        </div>
        {isWeek && (
          <div className="flex flex-wrap items-center gap-1">
            {weekStart !== thisWeek && (
              <button type="button" onClick={() => setWeekStart(thisWeek)}
                className="pressable h-9 coarse:h-10 px-3 rounded-xl text-sm font-medium text-primary-ink hover:bg-primary/10 outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Ten tydzień
              </button>
            )}
            <button type="button" onClick={copyWeek}
              className="pressable flex items-center gap-1.5 h-9 coarse:h-10 px-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <CalendarRange className="w-4 h-4" /> Skopiuj ten tydzień na następny
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 sm:justify-center sm:gap-4">
        <button type="button" onClick={() => (isWeek ? setWeekStart((w) => addDaysToKey(w, -7)) : setMonth((m) => addMonths(m, -1)))}
          aria-label={isWeek ? "Poprzedni tydzień" : "Poprzedni miesiąc"} className={navButton}>
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="min-w-0 sm:min-w-[12rem] text-center">
          <button type="button" onClick={() => (isWeek ? setWeekStart(thisWeek) : setMonth(startOfMonth(new Date())))}
            title={isWeek ? "Wróć do bieżącego tygodnia" : "Wróć do bieżącego miesiąca"}
            className={cn("pressable w-full h-10 coarse:h-11 truncate font-display font-bold text-lg px-3 rounded-xl hover:bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring", !isWeek && "capitalize")}>
            {isWeek ? weekRangeLabel(weekStart) : format(month, "LLLL yyyy", { locale: pl })}
          </button>
        </h2>
        <button type="button" onClick={() => (isWeek ? setWeekStart((w) => addDaysToKey(w, 7)) : setMonth((m) => addMonths(m, 1)))}
          aria-label={isWeek ? "Następny tydzień" : "Następny miesiąc"} className={navButton}>
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

      {brush.kind === "type" && typesById.get(brush.id)?.kind !== "absence" && typesById.has(brush.id) && (
        <BrushHours key={brush.id} type={typesById.get(brush.id)!} hours={activeHours}
          onChange={(hours) => setBrushHours(hours ? { typeId: brush.id, hours } : null)} />
      )}

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

      <p role="status" aria-live="polite" className="sr-only">{announce}</p>
      <p aria-live="polite" className="sr-only">{isWeek ? weekRangeLabel(weekStart) : format(month, "LLLL yyyy", { locale: pl })}</p>

      <p id="shift-brush-hint" className="-mt-3 text-xs text-muted-foreground px-1">{brushHint(brush, typesById, activeHours)}</p>

      {/* Podpowiedź o przenoszeniu: po „Rozumiem” zostaje tylko dla czytnika ekranu (aria-describedby siatki). */}
      <p id="shift-move-hint" className={cn("-mt-3 text-xs text-muted-foreground px-1", moveHintSeen && "sr-only")}>
        {IS_TOUCH
          ? "Przytrzymaj zmianę i przeciągnij na inny dzień — zapytam, czy przenieść, czy skopiować."
          : `Przeciągnij zmianę na inny dzień, żeby ją przenieść (z Alt — skopiować). Klawiatura: Shift+strzałki przenoszą zmianę, Alt+Shift+strzałki kopiują, ${modShortcut("C")} / ${modShortcut("V")} kopiuje wpis dnia (zmiana, odchylenie, notatka).`}
        {clip && <span className="font-medium"> Schowek: {typesById.get(clip.type)?.name ?? "wpis"}{clip.note ? " z notatką" : ""}.</span>}
        {!moveHintSeen && (
          <button type="button" onClick={dismissMoveHint}
            className="ml-1 inline-flex items-center rounded-md px-1.5 py-0.5 coarse:py-2 font-medium text-primary-ink hover:bg-primary/10 outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Rozumiem
          </button>
        )}
      </p>

      <ShiftDnd days={data.days} typesById={typesById} onTransfer={onDrop}>
        {isWeek ? (
          <ShiftWeekView weekStart={weekStart} days={data.days} typesById={typesById} remindersByDay={remindersByDay} titleOf={titleOf}
            onDay={onDay} onWeekChange={setWeekStart} describedBy="shift-brush-hint shift-move-hint" actions={actions} />
        ) : (
          <ShiftMonthGrid month={month} days={data.days} typesById={typesById} onDay={onDay} onMonthChange={setMonth} describedBy="shift-brush-hint shift-move-hint" actions={actions} />
        )}
      </ShiftDnd>

      <TransferChooser
        pending={asking}
        label={asking ? `${typesById.get(data.days[asking.from]?.type ?? "")?.name ?? "Zmiana"}: ${shortDate(asking.from)} → ${shortDate(asking.to)}` : ""}
        onChoose={(mode) => { if (asking) transfer(asking.from, asking.to, mode); setAsking(null); }}
        onClose={() => setAsking(null)}
      />

      <AlertDialog open={confirmCopy !== null} onOpenChange={(o) => { if (!o) setConfirmCopy(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nadpisać {confirmCopy?.overwritten} {pluralPl(confirmCopy?.overwritten ?? 0, ["dzień", "dni", "dni"])} w następnym tygodniu?</AlertDialogTitle>
            <AlertDialogDescription>
              Skopiowanie tygodnia zastąpi wpisy, które następny tydzień już ma w tych dniach. Da się to cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={runCopyWeek}>Nadpisz i skopiuj</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-wrap justify-end gap-1 -mt-2">
        <button type="button" onClick={exportCsv}
          className="pressable flex items-center gap-1.5 h-10 coarse:h-11 px-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <FileSpreadsheet className="w-4 h-4" /> Karta czasu (.csv)
        </button>
        <button type="button" onClick={exportIcs}
          className="pressable flex items-center gap-1.5 h-10 coarse:h-11 px-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <CalendarArrowDown className="w-4 h-4" /> Do kalendarza (.ics)
        </button>
      </div>

      <ShiftSummary summary={summary} hourlyRate={data.hourlyRate} workSystem={data.workSystem} settlementMonths={data.settlementMonths} fte={data.fte} monthLabel={format(shownMonth, "LLLL yyyy", { locale: pl })} onOpenSettings={() => setSettingsOpen(true)} />
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
        defaultStart={isWeek ? weekStart : dayKey(month)}
        onApply={applyPattern}
      />
    </div>
  );
}

/** Dotyk nie ma Alta — po upuszczeniu zmiany pytamy, co z nią zrobić. */
function TransferChooser({ pending, label, onChoose, onClose }: {
  pending: { from: string; to: string } | null;
  label: string;
  onChoose: (mode: TransferMode) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={pending !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent sheet className="max-w-xs">
        <DialogHeader>
          <DialogTitle>Przenieść czy skopiować?</DialogTitle>
          <DialogDescription>{label}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => onChoose("copy")}>Skopiuj</Button>
          <Button type="button" onClick={() => onChoose("move")}>Przenieś</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
