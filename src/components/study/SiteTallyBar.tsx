import { cn } from "@/lib/utils";
import { pluralPl } from "@/lib/plural";
import type { SiteTally } from "@/lib/study/siteTally";
import type { PointsProgress } from "@/lib/study/points";

/** Przewija kartę do panelu (etapy, braki, zamówienie) — przy długiej liście etapów braki są daleko w dół. */
function scrollToPanel(testId: string) {
  const el = document.querySelector(`[data-testid="site-card"] [data-testid="${testId}"]`);
  const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

const positionsPl = (n: number) => pluralPl(n, ["pozycja", "pozycje", "pozycji"]);

/**
 * Liczniki budowy jak rubryki w zeszycie: etapy, punkty (gdy są, H2.2), braki do zamówienia, kształtki do zamówienia.
 * Stuknięcie przewija do panelu. „Brakuje” na czerwono (jak w panelu braków), zero wyciszone.
 */
export function SiteTallyBar({ tally, points }: { tally: SiteTally; /** H2.2: punkty gotowe z wszystkich; komórka tylko, gdy są punkty. */ points?: PointsProgress }) {
  const cells = [
    { id: "site-stages", label: "Etapy", value: `${tally.stages.done}/${tally.stages.total}`, tone: "plain", sub: null,
      aria: `Etapy: ${tally.stages.done} z ${tally.stages.total}` },
    ...(points && points.total > 0 ? [{ id: "site-points", label: "Punkty", value: `${points.done}/${points.total}`, tone: "plain", sub: null,
      aria: `Punkty: ${points.done} z ${points.total} gotowe` }] as const : []),
    { id: "site-shortages", label: "Braki", value: String(tally.missing), tone: tally.missing > 0 ? "alarm" : "quiet",
      sub: tally.ordered > 0 ? `w drodze ${tally.ordered}` : null,
      aria: `Braki: ${tally.missing} do zamówienia${tally.ordered > 0 ? `, ${tally.ordered} w drodze` : ""}` },
    { id: "site-order", label: "Zamówić", value: String(tally.order), tone: tally.order > 0 ? "plain" : "quiet",
      sub: tally.order > 0 ? positionsPl(tally.order) : null,
      aria: `Do zamówienia: ${tally.order} ${positionsPl(tally.order)} kształtek` },
  ] as const;
  return (
    <nav aria-label="Stan budowy" className={cn("grid divide-x divide-dashed divide-border rounded-card border border-border bg-muted/30", cells.length === 4 ? "grid-cols-4" : "grid-cols-3")} data-testid="site-tally">
      {cells.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => scrollToPanel(c.id)}
          aria-label={c.aria}
          className="pressable flex min-w-0 flex-col items-start gap-1 px-3 py-2 text-left first:rounded-l-xl last:rounded-r-xl hover:bg-muted/60 coarse:min-h-11"
        >
          <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{c.label}</span>
          <span className={cn("font-mono text-lg leading-none tabular-nums", c.tone === "alarm" ? "text-destructive-ink" : c.tone === "quiet" ? "text-muted-foreground" : "text-foreground")}>{c.value}</span>
          {c.sub && <span className="max-w-full truncate text-2xs text-muted-foreground">{c.sub}</span>}
        </button>
      ))}
    </nav>
  );
}
