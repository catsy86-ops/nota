import { useEffect, useMemo, useState } from "react";
import { Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveDialogContent } from "@/components/ui/responsive-dialog";
import { haptic } from "@/lib/haptics";
import { useShifts } from "@/lib/shifts";
import { formatDuration, formatHoursShort } from "@/lib/shifts/time";
import { dayKeyOf, workOn } from "@/lib/study/report";
import { dayHours, parseHours } from "@/lib/study/siteHours";
import { setDayHours, useStudy } from "@/lib/study/store";
import { cn } from "@/lib/utils";

const fieldClass =
  "h-10 w-24 rounded-lg border border-border bg-background px-3 text-right font-mono text-base tabular-nums text-foreground outline-hidden focus:ring-2 focus:ring-ring coarse:h-11 sm:text-sm";

/**
 * Podział godzin dnia z Grafiku między budowy (H2). Pole puste = zasada z `siteHours.ts` (jedyna
 * budowa bez godzin dostaje resztę dnia); podpowiedź w polu pokazuje, ile by wyszło.
 */
export function DayHoursDialog({ day, label, onOpenChange }: {
  /** Dzień „2026-10-14”; `null` = zamknięte. */
  day: string | null;
  label: string;
  onOpenChange: (open: boolean) => void;
}) {
  const study = useStudy();
  const shifts = useShifts();
  const work = day ? workOn(shifts, day) : null;
  const split = useMemo(
    () => (day ? dayHours(study.journal, study.sites, work?.minutes ?? 0, day, dayKeyOf) : null),
    [day, study.journal, study.sites, work?.minutes],
  );
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!split) return;
    setValues(Object.fromEntries(split.sites.map((s) => [s.siteId, s.set ? formatHoursShort(s.minutes ?? 0) : ""])));
    // Tylko przy otwarciu dnia — zmiana z drugiego telefonu nie kasuje wpisywanych liczb.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  if (!split) return <Dialog open={false} onOpenChange={onOpenChange} />;

  const parsed = Object.fromEntries(split.sites.map((s) => [s.siteId, parseHours(values[s.siteId] ?? "")]));
  const bad = split.sites.filter((s) => parsed[s.siteId] === null).map((s) => s.siteId);
  // Podgląd zasady na wpisanych liczbach: pola puste dostają resztę tylko, gdy puste jest jedno.
  const typed = split.sites.filter((s) => (values[s.siteId] ?? "").trim() !== "");
  const typedSum = typed.reduce((sum, s) => sum + (parsed[s.siteId] ?? 0), 0);
  const empty = split.sites.length - typed.length;
  const left = split.work - typedSum;
  const hint = (siteId: string) =>
    (values[siteId] ?? "").trim() === "" && empty === 1 && left > 0 ? formatHoursShort(left) : "";

  function evenly() {
    const each = Math.round(split!.work / split!.sites.length / 5) * 5;
    setValues(Object.fromEntries(split!.sites.map((s) => [s.siteId, formatHoursShort(each)])));
  }

  function save() {
    if (bad.length > 0) return;
    setDayHours(day!, Object.fromEntries(split!.sites.map((s) => [s.siteId, parsed[s.siteId] ?? 0])));
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
            {label}
            {work ? <> · Grafik: {work.label}{split.work > 0 && <>, <span className="whitespace-nowrap">{formatDuration(split.work)}</span></>}</> : " · w Grafiku brak zmiany"}
          </DialogDescription>
        </div>
        <form className="space-y-3 px-5 py-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <ul className="space-y-2">
            {split.sites.map((s) => (
              <li key={s.siteId}>
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">{s.site}</span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <input
                      inputMode="decimal"
                      value={values[s.siteId] ?? ""}
                      placeholder={hint(s.siteId) || "0"}
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
          {bad.length > 0 && <p className="text-xs text-destructive-ink" role="alert">Wpisz godziny jak 6, 6,5 albo 6:30.</p>}
          {split.work > 0 && (
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
            <Button type="button" variant="outline" onClick={evenly} disabled={split.work <= 0} className="pressable coarse:h-11">Po równo</Button>
            <Button type="submit" disabled={bad.length > 0} className="pressable coarse:h-11">Zapisz</Button>
          </div>
        </form>
      </ResponsiveDialogContent>
    </Dialog>
  );
}
