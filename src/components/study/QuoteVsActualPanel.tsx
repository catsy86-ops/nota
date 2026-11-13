import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { money } from "@/lib/study/billing";
import type { Job } from "@/lib/study/jobs";
import { hoursLabel, quoteVsActual } from "@/lib/study/quoteVsActual";
import type { SiteInfo } from "@/lib/study/sites";
import { useSiteMaterialUsage } from "@/lib/study/useSiteMaterialUsage";

/** „+30 zł ponad wycenę” / „20 zł poniżej wyceny” / „zgodnie z wyceną”; kolor tylko wspiera, znak i słowa niosą sens. */
function Diff({ value, testId }: { value: number; testId?: string }) {
  if (value === 0) return <span className="text-muted-foreground" data-testid={testId}>zgodnie z wyceną</span>;
  const over = value > 0;
  return (
    <span className={cn("font-mono tabular-nums", over ? "text-warning-ink" : "text-success-ink")} data-testid={testId}>
      {over ? "+" : "−"}{money(Math.abs(value))} {over ? "ponad wycenę" : "poniżej wyceny"}
    </span>
  );
}

/**
 * Wycena a wykonanie (plan wycen i klientów, 5.2): materiał wyceniony i zużyty w cenach zakupu, robocizna wyceniona
 * i godziny z karty × stawka karty, różnica w złotych. Pokazuje się dopiero, gdy jest co porównać.
 */
export function QuoteVsActualPanel({ site, job }: { site: SiteInfo; job: Job }) {
  const usage = useSiteMaterialUsage(site);
  const v = useMemo(() => quoteVsActual(job, usage, site.hours, site.rate), [job, usage, site.hours, site.rate]);
  if (job.items.length === 0 || !v.hasData) return null;
  return (
    <section aria-label="Wycena a wykonanie" className="space-y-1 rounded-field bg-muted/40 p-2 text-sm" data-testid="quote-vs-actual">
      <h4 className="text-xs font-semibold text-muted-foreground">Wycena a wykonanie</h4>
      {v.usedMaterial !== null && v.materialDiff !== null && (
        <div data-testid="qva-material">
          <p className="flex flex-wrap justify-between gap-x-3"><span>Materiał (ceny zakupu)</span><Diff value={v.materialDiff} testId="qva-material-diff" /></p>
          <p className="ui-meta">wyceniono {money(v.quotedMaterial)} · zużyto {money(v.usedMaterial)}{v.unpriced > 0 ? ` · bez ceny: ${v.unpriced}` : ""}</p>
        </div>
      )}
      {v.hours > 0 && (
        <div data-testid="qva-labor">
          {v.laborDiff !== null && v.actualLabor !== null ? (
            <>
              <p className="flex flex-wrap justify-between gap-x-3"><span>Robocizna</span><Diff value={v.laborDiff} testId="qva-labor-diff" /></p>
              <p className="ui-meta">wyceniono {money(v.quotedLabor)} · {hoursLabel(v.hours)} × {money(v.rate ?? 0)} = {money(v.actualLabor)}</p>
            </>
          ) : (
            <>
              <p className="flex flex-wrap justify-between gap-x-3"><span>Robocizna</span><span className="ui-meta">{hoursLabel(v.hours)} przepracowano</span></p>
              <p className="ui-meta">Wpisz stawkę godzinową w karcie budowy (zł/h), żeby porównać z wyceną {money(v.quotedLabor)}.</p>
            </>
          )}
        </div>
      )}
      {v.totalDiff !== null && v.materialDiff !== null && v.laborDiff !== null && (
        <p className="flex flex-wrap justify-between gap-x-3 border-t border-dashed border-border pt-1 font-semibold"><span>Razem</span><Diff value={v.totalDiff} testId="qva-total" /></p>
      )}
    </section>
  );
}
