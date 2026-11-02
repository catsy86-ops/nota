import { useMemo } from "react";
import { PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/haptics";
import { pluralPl } from "@/lib/plural";
import { toastWithUndo } from "@/lib/undoToast";
import { estimateFromPoints } from "@/lib/study/kits";
import { useKits } from "@/lib/study/kitsStore";
import { metersLabel } from "@/lib/study/pipes";
import { pointStage, pointType, type WaterPoint } from "@/lib/study/points";
import { addShortage } from "@/lib/study/shortages";
import { setSiteShortages } from "@/lib/study/store";
import type { SiteInfo } from "@/lib/study/sites";

/**
 * H2.5 Materiał na start z punktów: punkty bez podejścia × zestaw przypisany do typu punktu (H1.2).
 * „Dodaj do braków” wpisuje pozycje jako braki „Brakuje” — stąd trafiają do „Do zamówienia” w karcie
 * i na wspólną listę do hurtowni (H1.4). Szacunek dotyczy podejść, nie pionów ani rozprowadzenia.
 */
export function PointsEstimate({ site, points }: { site: SiteInfo; points: readonly WaterPoint[] }) {
  const { kits } = useKits();
  const start = useMemo(() => points.filter((p) => pointStage(p) === 0), [points]);
  const est = useMemo(() => estimateFromPoints(start, kits), [start, kits]);
  if (start.length === 0) return null;
  const empty = est.fittings.length === 0 && est.pipes.length === 0;

  function addToShortages() {
    const before = site.shortages ?? [];
    let next = before;
    const now = Date.now();
    for (const p of est.pipes) next = addShortage(next, p.name, metersLabel(p.cm), now);
    for (const f of est.fittings) next = addShortage(next, f.name, `${f.qty} szt.`, now);
    setSiteShortages(site.id, next, before);
    haptic("success");
    toastWithUndo(`Dodano do braków: ${est.pipes.length + est.fittings.length} ${pluralPl(est.pipes.length + est.fittings.length, ["pozycja", "pozycje", "pozycji"])}`,
      () => setSiteShortages(site.id, before, next));
  }

  return (
    <details className="rounded-card border border-dashed border-border px-3 py-2 text-sm" data-testid="points-estimate">
      <summary className="cursor-pointer select-none coarse:py-2">
        <span className="font-medium">Materiał na start</span>{" "}
        <span className="text-xs text-muted-foreground">z zestawów · {est.covered} z {start.length} {pluralPl(start.length, ["punktu", "punktów", "punktów"])} bez podejścia</span>
      </summary>
      <div className="mt-2 space-y-2">
        {empty ? (
          <p className="text-xs text-muted-foreground">Żaden typ punktu nie ma zestawu. Przypisz go w „Zestawy materiału” (w arkuszu wpisu).</p>
        ) : (
          <ul className="space-y-0.5" data-testid="points-estimate-items">
            {est.pipes.map((p) => (
              <li key={`rura-${p.name}`} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate">{p.name}</span><span className="shrink-0 font-mono tabular-nums">{metersLabel(p.cm)}</span>
              </li>
            ))}
            {est.fittings.map((f) => (
              <li key={f.name} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate">{f.name}</span><span className="shrink-0 font-mono tabular-nums">{f.qty} szt.</span>
              </li>
            ))}
          </ul>
        )}
        {est.uncovered.length > 0 && (
          <p className="text-2xs text-muted-foreground">
            Bez zestawu: {est.uncovered.map((u) => `${pointType(u.type).label} ×${u.count}`).join(", ")}.
          </p>
        )}
        <p className="text-2xs text-muted-foreground">Szacunek na podejścia — piony i rozprowadzenie policz osobno.</p>
        <Button type="button" size="sm" variant="outline" onClick={addToShortages} disabled={empty} className="coarse:h-11">
          <PackagePlus className="h-4 w-4" aria-hidden />Dodaj do braków
        </Button>
      </div>
    </details>
  );
}
