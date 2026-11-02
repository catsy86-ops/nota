import { useEffect, useMemo, useSyncExternalStore } from "react";
import { pluralPl } from "@/lib/plural";
import { studyReady, useStudyReady } from "@/lib/study/data";
import { useSiteDirectory } from "@/lib/study/store";
import { getSiteBilling, subscribeBilling } from "@/lib/study/billingStore";
import { getSitePoints, subscribePoints } from "@/lib/study/pointsStore";
import { money, monthSiteEarnings } from "@/lib/study/billing";
import { siteStages } from "@/lib/study/stages";
import { useJobs } from "@/lib/study/jobsStore";
import { quoteTotals } from "@/lib/study/jobs";

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
      sum += quoteTotals(j).total;
      count++;
    }
    return { sum: Math.round(sum * 100) / 100, count };
  }, [jobs, from, to]);
  if (!ready || (rows.length === 0 && own.count === 0)) return null;
  const ownLine = own.count > 0 && (
    <p className="flex items-baseline gap-2 px-3 text-sm" data-testid="own-month-earnings">
      <span className="font-medium">Moje zlecenia</span>
      <span className="text-xs text-muted-foreground">{own.count} {pluralPl(own.count, ["zapłacone", "zapłacone", "zapłaconych"])}, poza Grafikiem</span>
      <span aria-hidden className="min-w-4 flex-1 translate-y-[-0.2em] border-b border-dotted border-muted-foreground/50" />
      <span className="font-mono font-semibold tabular-nums">{money(own.sum)}</span>
    </p>
  );
  if (rows.length === 0) return ownLine;
  const total = Math.round(rows.reduce((sum, r) => sum + r.e.total, 0) * 100) / 100;
  const noRate = rows.reduce((sum, r) => sum + r.e.pointsNoRate, 0);

  return (
    <>
    <details className="group rounded-card border border-dashed border-border px-3 py-2" data-testid="site-month-earnings">
      <summary className="flex cursor-pointer list-none items-baseline gap-2 text-sm coarse:min-h-11 coarse:items-center">
        <span className="font-medium">Z budów</span>
        <span className="text-xs text-muted-foreground">punkty, ryczałt</span>
        <span aria-hidden className="min-w-4 flex-1 translate-y-[-0.2em] border-b border-dotted border-muted-foreground/50" />
        <span className="font-mono font-semibold tabular-nums text-primary-ink" data-testid="site-month-total">{money(total)}</span>
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
      {noRate > 0 && <p className="mt-1 text-2xs text-muted-foreground">Gotowe punkty bez stawki (nie liczone): {noRate}. Stawki ustawisz w karcie budowy → Rozliczenie.</p>}
      <p className="mt-2 flex justify-between border-t border-dashed border-border pt-1 text-sm">
        <span className="text-muted-foreground">Razem z godzinami z Grafiku</span>
        <span className="font-mono font-semibold tabular-nums" data-testid="site-month-grand">{money(Math.round((base + total) * 100) / 100)}</span>
      </p>
    </details>
    {ownLine}
    </>
  );
}
