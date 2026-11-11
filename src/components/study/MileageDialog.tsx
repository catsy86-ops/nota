import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, FileSpreadsheet, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { localDayKey } from "@/lib/dayDone";
import { downloadBlob } from "@/lib/downloadBlob";
import { toastWithUndo } from "@/lib/undoToast";
import { money, parseAmount } from "@/lib/study/billing";
import { addMileageEntry, removeMileageEntry, useMileage } from "@/lib/study/companyPrefs";
import {
  exportMileageCSV, MILEAGE_DISTANCE_MAX, MILEAGE_RATE_MAX, mileageCost, mileageTotals, monthEntries, suggestMileage,
  type MileageEntry,
} from "@/lib/study/mileage";
import type { SiteInfo } from "@/lib/study/sites";

const fieldCls = "h-9 w-full rounded-field border border-input bg-background px-2 text-sm text-foreground outline-hidden focus:ring-2 focus:ring-ring coarse:h-11";
const newId = () => `km-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const num = (n: number) => n.toLocaleString("pl-PL", { maximumFractionDigits: 2 });
const monthLabel = (y: number, m: number) => new Date(y, m - 1, 1).toLocaleDateString("pl-PL", { month: "long", year: "numeric" });
const dayLabel = (t: number) => new Date(t).toLocaleDateString("pl-PL", { weekday: "short", day: "numeric", month: "numeric" });

/**
 * B4.3 Kilometrówka: trasa dnia (budowy po kolei), kilometry z licznika albo podpowiedź z lokalizacji budów
 * (linia prosta × 1,3), stawka za km i zestawienie miesiąca z CSV dla księgowej. Dane zostają na urządzeniu.
 */
export function MileageDialog({ open, onOpenChange, dir }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dir: readonly SiteInfo[];
}) {
  const store = useMileage();
  const today = localDayKey();
  const [day, setDay] = useState(today);
  const [route, setRoute] = useState<string[]>([]);
  const [distance, setDistance] = useState("");
  /** `null` = pole nietknięte (pokazuje stawkę z magazynu); tekst, także pusty, to wpis użytkownika. */
  const [rate, setRate] = useState<string | null>(null);
  const [view, setView] = useState(() => ({ y: new Date().getFullYear(), m: new Date().getMonth() + 1 }));

  const active = useMemo(() => dir.filter((s) => s.archived === undefined), [dir]);
  const byId = useMemo(() => new Map(dir.map((s) => [s.id, s] as const)), [dir]);
  const nameOf = (id: string) => byId.get(id)?.name ?? id;

  const routeSites = route.map((id) => byId.get(id)).filter((s): s is SiteInfo => !!s);
  const withGeo = routeSites.filter((s) => s.geo);
  const missingGeo = routeSites.filter((s) => !s.geo);
  const suggested = withGeo.length >= 2 ? suggestMileage(withGeo.map((s) => [s.geo!.lat, s.geo!.lng])) : 0;

  const rateText = rate ?? String(store.rate).replace(".", ",");
  const entries = monthEntries(store.entries, view.y, view.m);
  const totals = mileageTotals(entries);

  function toggle(id: string) {
    setRoute((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));
    haptic("selection");
  }

  function shiftMonth(delta: number) {
    setView((v) => { const d = new Date(v.y, v.m - 1 + delta, 1); return { y: d.getFullYear(), m: d.getMonth() + 1 }; });
  }

  function save() {
    const km = parseAmount(distance);
    const rt = parseAmount(rateText);
    if (typeof km !== "number" || km <= 0 || km > MILEAGE_DISTANCE_MAX) { toast.error(`Kilometry: wpisz liczbę od 0,1 do ${MILEAGE_DISTANCE_MAX}, np. 48,5`); return; }
    if (typeof rt !== "number" || rt > MILEAGE_RATE_MAX) { toast.error(`Stawka: wpisz kwotę za kilometr, np. 0,89`); return; }
    const date = new Date(`${day || today}T12:00:00`).getTime();
    if (!Number.isFinite(date)) { toast.error("Wybierz dzień przejazdu"); return; }
    const entry: MileageEntry = { id: newId(), date, siteIds: route, distance: km, rate: rt, ...(suggested > 0 ? { calculatedDistance: suggested } : {}) };
    if (!addMileageEntry(entry)) { toast.error("Nie udało się zapisać przejazdu — za dużo wpisów"); return; }
    haptic("success");
    const d = new Date(date);
    setView({ y: d.getFullYear(), m: d.getMonth() + 1 });
    setRoute([]);
    setDistance("");
    setRate(null);
    toast.success(`Dodano przejazd: ${num(km)} km, ${money(mileageCost(km, rt))}`);
  }

  function remove(e: MileageEntry) {
    const gone = removeMileageEntry(e.id);
    if (gone) toastWithUndo(`Usunięto przejazd ${num(gone.distance)} km`, () => { addMileageEntry(gone); });
  }

  function csv() {
    const file = exportMileageCSV({ year: view.y, month: view.m, entries }, nameOf);
    downloadBlob(new Blob([file], { type: "text/csv;charset=utf-8" }), `Kilometrówka ${view.y}-${String(view.m).padStart(2, "0")}.csv`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="mileage-dialog">
        <DialogHeader>
          <DialogTitle className="font-display">Kilometrówka</DialogTitle>
          <DialogDescription>Trasa dnia, kilometry i stawka. Zestawienie miesiąca pobierzesz jako CSV dla księgowej.</DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => { e.preventDefault(); save(); }} aria-label="Nowy przejazd" className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-xs text-muted-foreground">
              Dzień
              <input type="date" value={day} max={today} onChange={(e) => setDay(e.target.value)} className={fieldCls} />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              Stawka za km (zł)
              <input inputMode="decimal" value={rateText} onChange={(e) => setRate(e.target.value)} className={cn(fieldCls, "text-right font-mono tabular-nums")} />
            </label>
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-xs text-muted-foreground">Budowy po kolei</legend>
            {active.length === 0 ? (
              <p className="ui-hint">Nie masz jeszcze budów. Dodaj wpis w Dzienniku, a pojawią się tutaj.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {active.map((s) => {
                  const i = route.indexOf(s.id);
                  return (
                    <button key={s.id} type="button" onClick={() => toggle(s.id)} aria-pressed={i >= 0}
                      className={cn("pressable inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1 text-sm coarse:min-h-11",
                        i >= 0 ? "border-primary bg-primary/10 font-medium text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
                      {i >= 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 font-mono text-2xs text-primary-foreground" aria-label={`przystanek ${i + 1}`}>{i + 1}</span>}
                      <span className="truncate">{s.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </fieldset>

          <label className="block space-y-1 text-xs text-muted-foreground">
            Kilometry (z licznika)
            <input inputMode="decimal" value={distance} onChange={(e) => setDistance(e.target.value)} placeholder="np. 48,5" className={cn(fieldCls, "text-right font-mono tabular-nums")} />
          </label>
          {suggested > 0 && (
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground" data-testid="mileage-suggest">
              <span>Z lokalizacji budów: około {num(suggested)} km (linia prosta × 1,3).</span>
              <Button type="button" variant="outline" size="sm" onClick={() => setDistance(String(suggested).replace(".", ","))} className="shrink-0 coarse:h-11">Wpisz</Button>
            </div>
          )}
          {missingGeo.length > 0 && routeSites.length >= 2 && (
            <p className="ui-hint">Bez lokalizacji: {missingGeo.map((s) => s.name).join(", ")}. Zapisz ją w karcie budowy, a podpowiedź uwzględni także tę budowę.</p>
          )}
          <Button type="submit" className="w-full coarse:h-11">Dodaj przejazd</Button>
        </form>

        <section aria-label="Zestawienie miesiąca" className="space-y-2 border-t border-dashed border-border pt-2.5">
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={() => shiftMonth(-1)} aria-label="Poprzedni miesiąc" className="pressable grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:text-foreground coarse:h-11 coarse:w-11">
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <h3 className="text-sm font-semibold capitalize" aria-live="polite">{monthLabel(view.y, view.m)}</h3>
            <button type="button" onClick={() => shiftMonth(1)} aria-label="Następny miesiąc" className="pressable grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:text-foreground coarse:h-11 coarse:w-11">
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>

          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Brak przejazdów w tym miesiącu.</p>
          ) : (
            <ul className="max-h-[28dvh] space-y-1 overflow-y-auto text-sm" aria-label="Przejazdy">
              {entries.map((e) => (
                <li key={e.id} className="flex items-center gap-2" data-testid="mileage-entry">
                  <span className="min-w-0 flex-1">
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">{dayLabel(e.date)}</span>{" "}
                    <span className="truncate">{e.siteIds.length > 0 ? e.siteIds.map(nameOf).join(" → ") : "bez trasy"}</span>
                  </span>
                  <span className="shrink-0 text-right font-mono tabular-nums">{num(e.distance)} km<span className="block text-2xs text-muted-foreground">{money(mileageCost(e.distance, e.rate))}</span></span>
                  <button type="button" onClick={() => remove(e)} aria-label={`Usuń przejazd ${num(e.distance)} km z ${dayLabel(e.date)}`}
                    className="pressable -mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground coarse:h-11 coarse:w-11">
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="flex items-baseline justify-between" data-testid="mileage-total">
            <span className="text-sm font-semibold">Razem</span>
            <span className="border-b-[3px] border-double border-primary pb-0.5 font-mono text-base font-bold tabular-nums">{num(totals.km)} km · {money(totals.cost)}</span>
          </p>
          <Button type="button" variant="outline" size="sm" onClick={csv} disabled={entries.length === 0} className="w-full coarse:h-11">
            <FileSpreadsheet className="h-4 w-4" aria-hidden />Pobierz CSV
          </Button>
        </section>
      </DialogContent>
    </Dialog>
  );
}
