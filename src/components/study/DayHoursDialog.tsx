import { useEffect, useMemo, useState } from "react";
import { evenShare } from "@/lib/study/siteHours";
import { Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveDialogContent } from "@/components/ui/responsive-dialog";
import { haptic } from "@/lib/haptics";
import { useShifts } from "@/lib/shifts";
import { formatDuration, formatHoursShort } from "@/lib/shifts/time";
import { localDayKey } from "@/lib/dayDone";
import { dayKeyOf, workOn } from "@/lib/study/report";
import { dayHours, parseHours } from "@/lib/study/siteHours";
import { dayLabel } from "@/lib/study/journalView";
import { setDayHours, useSiteDirectory, useStudy } from "@/lib/study/store";
import { cn } from "@/lib/utils";

const fieldClass =
  "h-10 w-24 rounded-lg border border-border bg-background px-3 text-right font-mono text-base tabular-nums text-foreground outline-hidden focus:ring-2 focus:ring-ring coarse:h-11 sm:text-sm";
const selectClass =
  "h-10 w-full rounded-lg border border-dashed border-border bg-background px-3 text-sm text-muted-foreground outline-hidden focus:ring-2 focus:ring-ring coarse:h-11";

/** Południe dnia „RRRR-MM-DD” — do etykiety bez przeskoku przy zmianie czasu. */
const noonOf = (key: string) => { const [y, m, d] = key.split("-").map(Number); return new Date(y, m - 1, d, 12).getTime(); };

/**
 * Podział godzin dnia z Grafiku między budowy (H2). Pole puste = zasada z `siteHours.ts` (jedyna
 * budowa bez godzin dostaje resztę dnia); podpowiedź w polu pokazuje, ile by wyszło.
 * Otwierane z nagłówka każdego dnia albo z karty budowy (`siteId`: ta budowa zawsze na liście, dzień do
 * zmiany w oknie). „+ Budowa” dokłada budowę bez wpisu tego dnia (1.5 planu Praca 2026-10-24).
 */
export function DayHoursDialog({ day, label, siteId, onOpenChange }: {
  /** Dzień „2026-10-14”; `null` = zamknięte. */
  day: string | null;
  /** Etykieta dnia z osi; bez niej — z daty. */
  label?: string;
  /** Budowa zawsze na liście (okno z karty) — wtedy dzień można zmienić w oknie. */
  siteId?: string;
  onOpenChange: (open: boolean) => void;
}) {
  if (!day) return <Dialog open={false} onOpenChange={onOpenChange} />;
  // Nowe otwarcie (inny dzień albo budowa) = świeży stan okna.
  return <DayHoursBody key={`${day}␁${siteId ?? ""}`} day={day} label={label} siteId={siteId} onOpenChange={onOpenChange} />;
}

function DayHoursBody({ day, label, siteId, onOpenChange }: { day: string; label?: string; siteId?: string; onOpenChange: (open: boolean) => void }) {
  const study = useStudy();
  const dir = useSiteDirectory();
  const shifts = useShifts();
  const [current, setCurrent] = useState(day);
  /** Budowy dołożone ręcznie (bez wpisu tego dnia); budowa z karty — od razu. */
  const [extras, setExtras] = useState<string[]>(siteId ? [siteId] : []);
  const work = workOn(shifts, current);
  const split = useMemo(
    () => dayHours(study.journal, study.sites, work?.minutes ?? 0, current, dayKeyOf),
    [current, study.journal, study.sites, work?.minutes],
  );
  const known = new Set(split.sites.map((s) => s.siteId));
  const rows = [
    ...split.sites.map((s) => ({ ...s, extra: false })),
    ...extras.filter((id) => !known.has(id)).map((id) => ({ siteId: id, site: dir.find((x) => x.id === id)?.name ?? id, minutes: null, set: false, extra: true })),
  ];
  const addable = dir.filter((x) => x.archived === undefined && !rows.some((r) => r.siteId === x.id));
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    setValues(Object.fromEntries(split.sites.map((s) => [s.siteId, s.set ? formatHoursShort(s.minutes ?? 0) : ""])));
    // Tylko przy zmianie dnia — zmiana z drugiego telefonu nie kasuje wpisywanych liczb.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const parsed = Object.fromEntries(rows.map((s) => [s.siteId, parseHours(values[s.siteId] ?? "")]));
  const bad = rows.filter((s) => parsed[s.siteId] === null).map((s) => s.siteId);
  // Podgląd zasady na wpisanych liczbach: pola puste dostają resztę tylko, gdy puste jest jedno. Dołożona
  // budowa bez liczby to 0 — nie ma wpisu tego dnia, więc zasada „reszta dnia” jej nie dotyczy.
  const typed = rows.filter((s) => (values[s.siteId] ?? "").trim() !== "");
  const typedSum = typed.reduce((sum, s) => sum + (parsed[s.siteId] ?? 0), 0);
  const empty = rows.filter((s) => !s.extra && (values[s.siteId] ?? "").trim() === "").length;
  const left = split.work - typedSum;
  const hint = (s: (typeof rows)[number]) =>
    !s.extra && (values[s.siteId] ?? "").trim() === "" && empty === 1 && left > 0 ? formatHoursShort(left) : "";
  const shownLabel = label && current === day ? label : dayLabel(noonOf(current));

  function evenly() {
    const each = evenShare(split.work, rows.length);
    setValues(Object.fromEntries(rows.map((s) => [s.siteId, formatHoursShort(each)])));
  }

  function save() {
    if (bad.length > 0) return;
    // Dołożona budowa bez godzin nic nie zapisuje (nie tworzy karty ani pustej listy).
    const minutes = Object.fromEntries(rows.filter((s) => !s.extra || (parsed[s.siteId] ?? 0) > 0).map((s) => [s.siteId, parsed[s.siteId] ?? 0]));
    setDayHours(current, minutes);
    haptic("success");
    toast.success("Zapisano godziny na budowach");
    onOpenChange(false);
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="gap-0 p-0 sm:max-w-sm" data-testid="day-hours">
        <div className="space-y-1 border-b border-border px-5 pb-4 pt-5 pr-12">
          <DialogTitle className="flex items-center gap-1.5 font-display text-lg">
            <Clock className="h-5 w-5 shrink-0 text-primary-ink" aria-hidden />Godziny na budowach
          </DialogTitle>
          <DialogDescription className="text-xs">
            {shownLabel}
            {work ? <> · Grafik: {work.label}{split.work > 0 && <>, <span className="whitespace-nowrap">{formatDuration(split.work)}</span></>}</> : " · w Grafiku brak zmiany"}
          </DialogDescription>
        </div>
        <form className="space-y-3 px-5 py-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
          {siteId && (
            <label className="flex items-center justify-between gap-3 text-sm">
              Dzień
              <input
                type="date"
                value={current}
                max={localDayKey()}
                onChange={(e) => { if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) setCurrent(e.target.value); }}
                className="h-10 rounded-lg border border-border bg-background px-3 font-mono text-base tabular-nums text-foreground outline-hidden focus:ring-2 focus:ring-ring coarse:h-11 sm:text-sm"
              />
            </label>
          )}
          <ul className="space-y-2">
            {rows.map((s) => (
              <li key={s.siteId}>
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">
                    {s.site}
                    {s.extra && <span className="ml-1.5 text-xs text-muted-foreground">bez wpisu</span>}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <input
                      inputMode="decimal"
                      value={values[s.siteId] ?? ""}
                      placeholder={hint(s) || "0"}
                      onChange={(e) => setValues((v) => ({ ...v, [s.siteId]: e.target.value }))}
                      aria-label={`Godziny: ${s.site}`}
                      aria-invalid={bad.includes(s.siteId)}
                      className={cn(fieldClass, bad.includes(s.siteId) && "border-destructive")}
                    />
                    <span className="text-xs text-muted-foreground">h</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {rows.length === 0 && <p className="text-sm text-muted-foreground">Tego dnia nie ma wpisów — dodaj budowę z listy poniżej.</p>}
          {addable.length > 0 && (
            <select
              aria-label="Dodaj budowę bez wpisu tego dnia"
              value=""
              onChange={(e) => { const id = e.target.value; if (id) setExtras((x) => [...x, id]); }}
              className={selectClass}
            >
              <option value="">+ Budowa bez wpisu tego dnia</option>
              {addable.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          )}
          {bad.length > 0 && <p className="text-xs text-destructive-ink" role="alert">Wpisz godziny jak 6, 6,5 albo 6:30.</p>}
          {split.work > 0 && rows.length > 0 && (
            <p
              role="status"
              data-testid="day-hours-left"
              className={cn("font-mono text-xs tabular-nums", left < 0 ? "text-warning-ink" : "text-muted-foreground")}
            >
              {left < 0
                ? `Wpisano ${formatDuration(-left)} więcej niż w Grafiku`
                : empty === 1 && left > 0
                  ? `Puste pole dostanie resztę: ${formatDuration(left)}`
                  : left > 0 ? `Bez budowy: ${formatDuration(left)}` : "Cały dzień rozdzielony"}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button type="button" variant="outline" onClick={evenly} disabled={split.work <= 0 || rows.length === 0} className="pressable coarse:h-11">Po równo</Button>
            <Button type="submit" disabled={bad.length > 0 || rows.length === 0} className="pressable coarse:h-11">Zapisz</Button>
          </div>
        </form>
      </ResponsiveDialogContent>
    </Dialog>
  );
}
