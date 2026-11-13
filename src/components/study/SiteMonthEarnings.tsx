import { useEffect, useMemo, useSyncExternalStore } from "react";
import { FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadBlob } from "@/lib/downloadBlob";
import { pluralPl } from "@/lib/plural";
import { studyReady, useStudyReady } from "@/lib/study/data";
import { useSiteDirectory } from "@/lib/study/store";
import { getSiteBilling, subscribeBilling } from "@/lib/study/billingStore";
import { getSitePoints, subscribePoints } from "@/lib/study/pointsStore";
import { money, monthSiteEarnings } from "@/lib/study/billing";
import { siteStages } from "@/lib/study/stages";
import { useJobs } from "@/lib/study/jobsStore";
import { quoteSummary } from "@/lib/study/jobs";
import { createMonthlySummary, exportMonthlySummaryCSV, type MonthlySummaryLine } from "@/lib/study/monthlySummary";

const round2 = (n: number) => Math.round(n * 100) / 100;
const dmy = (key: string) => key.split("-").reverse().join(".");

/** Licznik zmian rozliczeń i punktów — przelicza linię, gdy coś się zmieni w Pracy. */
let tick = 0;
const bump = () => { tick++; };
function subscribe(cb: () => void) {
  const a = subscribeBilling(() => { bump(); cb(); });
  const b = subscribePoints(() => { bump(); cb(); });
  return () => { a(); b(); };
}
const getTick = () => tick;

/**
 * H3.3 „Z budów” w podsumowaniu Grafiku: punkty po białym montażu, odhaczone etapy i ryczałt za skończoną
 * budowę w oglądanym miesiącu. Bez godzin — te są już w zarobku Grafiku. Brak takich zarobków = nic.
 * H3.6: fuchy (zlecenia własne) nie wchodzą do „Z budów” ani do sumy z Grafikiem — osobna linia
 * „Moje zlecenia” z wycenami zapłaconymi w tym miesiącu.
 */
export function SiteMonthEarnings({ monthKey, base }: {
  /** „2026-10”. */
  monthKey: string;
  /** „Razem brutto” z Grafiku — do linii „Razem z budowami”. */
  base: number;
}) {
  const ready = useStudyReady();
  // Grafik bez wejścia do Pracy: dokument Pracy trzeba wczytać tutaj.
  useEffect(() => { void studyReady(); }, []);
  const dir = useSiteDirectory();
  const t = useSyncExternalStore(subscribe, getTick);
  const jobs = useJobs();
  const [from, to] = useMemo(() => {
    const [y, m] = monthKey.split("-").map(Number);
    return [new Date(y, m - 1, 1).getTime(), new Date(y, m, 1).getTime()];
  }, [monthKey]);
  const rows = useMemo(() => {
    void t;
    // Archiwalne też — budowę zwykle archiwizuje się po końcu, a jej ostatni miesiąc ma się policzyć.
    return dir.flatMap((s) => {
      if (jobs.has(s.id)) return [];
      const points = getSitePoints(s.id).points.map((p) => ({ type: p.type, doneAt: p.steps.montaz }));
      const e = monthSiteEarnings({ billing: getSiteBilling(s.id), points, stages: siteStages(s) }, from, to);
      return e.total > 0 || e.pointsNoRate > 0 ? [{ site: s, e }] : [];
    });
  }, [dir, from, to, jobs, t]);
  const own = useMemo(() => {
    let sum = 0, count = 0;
    for (const j of jobs.values()) {
      if (j.status !== "paid" || j.statusAt < from || j.statusAt >= to) continue;
      // Przy włączonym VAT przychodem wykonawcy jest netto, a nie kwota z VAT.
      const s = quoteSummary(j);
      sum += s.net ?? s.payable;
      count++;
    }
    return { sum: Math.round(sum * 100) / 100, count };
  }, [jobs, from, to]);
  // Wpłaty z rozliczeń budów (poza fuchami, te mają własny status „zapłacone”), które wpłynęły w oglądanym miesiącu.
  const paid = useMemo(() => {
    void t;
    const items = dir.flatMap((s) => jobs.has(s.id) ? [] : getSiteBilling(s.id).payments
      .filter((p) => p.day.startsWith(`${monthKey}-`))
      .map((p) => ({ day: p.day, site: s.name, amount: p.amount })));
    return { items, sum: round2(items.reduce((n, p) => n + p.amount, 0)) };
  }, [dir, jobs, monthKey, t]);
  if (!ready || (rows.length === 0 && own.count === 0 && paid.items.length === 0)) return null;
  const ownLine = own.count > 0 && (
    <p className="flex items-baseline gap-2 px-3 text-sm" data-testid="own-month-earnings">
      <span className="font-medium">Moje zlecenia</span>
      <span className="text-xs text-muted-foreground">{own.count} {pluralPl(own.count, ["zapłacone", "zapłacone", "zapłaconych"])}, poza Grafikiem</span>
      <span aria-hidden className="min-w-4 flex-1 translate-y-[-0.2em] border-b border-dotted border-muted-foreground/50" />
      <span className="font-mono font-semibold tabular-nums">{money(own.sum)}</span>
    </p>
  );
  if (rows.length === 0 && paid.items.length === 0) return ownLine;
  const total = Math.round(rows.reduce((sum, r) => sum + r.e.total, 0) * 100) / 100;
  const noRate = rows.reduce((sum, r) => sum + r.e.pointsNoRate, 0);

  function csv() {
    const lines: MonthlySummaryLine[] = rows.flatMap(({ site, e }) => [
      ...(e.points.count > 0 ? [{ label: `${site.name} — punkty`, quantity: e.points.count, total: e.points.amount }] : []),
      ...(e.stages.count > 0 ? [{ label: `${site.name} — etapy`, quantity: e.stages.count, total: e.stages.amount }] : []),
      ...(e.lump > 0 ? [{ label: `${site.name} — ryczałt (koniec budowy)`, quantity: 1, total: e.lump }] : []),
    ]);
    if (own.count > 0) lines.push({ label: "Moje zlecenia (zapłacone)", quantity: own.count, total: own.sum });
    downloadBlob(new Blob([exportMonthlySummaryCSV(createMonthlySummary(monthKey, lines, paid.items))], { type: "text/csv;charset=utf-8" }), `Zestawienie ${monthKey}.csv`);
  }

  return (
    <>
    <details className="group rounded-card border border-dashed border-border px-3 py-2" data-testid="site-month-earnings">
      <summary className="flex cursor-pointer list-none items-baseline gap-2 text-sm coarse:min-h-11 coarse:items-center">
        <span className="font-medium">{rows.length === 0 ? "Wpłaty z budów" : "Z budów"}</span>
        <span className="text-xs text-muted-foreground">punkty, ryczałt</span>
        <span aria-hidden className="min-w-4 flex-1 translate-y-[-0.2em] border-b border-dotted border-muted-foreground/50" />
        <span className="font-mono font-semibold tabular-nums text-primary-ink" data-testid="site-month-total">{money(rows.length === 0 ? paid.sum : total)}</span>
      </summary>
      <ul className="mt-2 space-y-1 text-xs">
        {rows.map(({ site, e }) => (
          <li key={site.id} className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1">
              <span className="font-medium">{site.name}</span>{" "}
              <span className="text-muted-foreground">{[
                e.points.count > 0 && `${e.points.count} ${pluralPl(e.points.count, ["punkt", "punkty", "punktów"])}`,
                e.stages.count > 0 && `${e.stages.count} ${pluralPl(e.stages.count, ["etap", "etapy", "etapów"])}`,
                e.lump > 0 && "ryczałt (koniec budowy)",
              ].filter(Boolean).join(" · ")}</span>
            </span>
            <span className="shrink-0 font-mono tabular-nums">{money(e.total)}</span>
          </li>
        ))}
      </ul>
      {paid.items.length > 0 && (
        <div className="mt-2 border-t border-dashed border-border pt-1" data-testid="month-payments">
          <p className="flex justify-between text-sm">
            <span className="font-medium">Wpłaty w miesiącu</span>
            <span className="font-mono font-semibold tabular-nums" data-testid="month-paid-total">{money(paid.sum)}</span>
          </p>
          <ul className="mt-1 space-y-0.5 text-xs" aria-label="Wpłaty w miesiącu">
            {paid.items.map((p, i) => (
              <li key={`${p.site}-${p.day}-${i}`} className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate"><span className="font-mono tabular-nums text-muted-foreground">{dmy(p.day)}</span> {p.site}</span>
                <span className="shrink-0 font-mono tabular-nums">{money(p.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {noRate > 0 && <p className="mt-1 text-2xs text-muted-foreground">Gotowe punkty bez stawki (nie liczone): {noRate}. Stawki ustawisz w karcie budowy → Rozliczenie.</p>}
      {rows.length > 0 && (
        <p className="mt-2 flex justify-between border-t border-dashed border-border pt-1 text-sm">
          <span className="text-muted-foreground">Razem z godzinami z Grafiku</span>
          <span className="font-mono font-semibold tabular-nums" data-testid="site-month-grand">{money(Math.round((base + total) * 100) / 100)}</span>
        </p>
      )}
      <Button type="button" variant="outline" size="sm" onClick={csv} className="mt-2 w-full coarse:h-11" data-testid="month-csv">
        <FileSpreadsheet className="h-4 w-4" aria-hidden />Pobierz zestawienie (CSV)
      </Button>
    </details>
    {ownLine}
    </>
  );
}
