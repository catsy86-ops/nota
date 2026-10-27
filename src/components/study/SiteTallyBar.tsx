import { cn } from "@/lib/utils";
import { pluralPl } from "@/lib/plural";
import type { SiteTally } from "@/lib/study/siteTally";

/** Przewija kartę do panelu (etapy, braki, zamówienie) — przy długiej liście etapów braki są daleko w dół. */
function scrollToPanel(testId: string) {
  const el = document.querySelector(`[data-testid="site-card"] [data-testid="${testId}"]`);
  const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

const positionsPl = (n: number) => pluralPl(n, ["pozycja", "pozycje", "pozycji"]);

/**
 * Trzy liczniki budowy jak rubryki w zeszycie: etapy, braki do zamówienia, kształtki do zamówienia.
 * Stuknięcie przewija do panelu. „Brakuje” na czerwono (jak w panelu braków), zero wyciszone.
 */
export function SiteTallyBar({ tally }: { tally: SiteTally }) {
  const cells = [
    { id: "site-stages", label: "Etapy", value: `${tally.stages.done}/${tally.stages.total}`, tone: "plain", sub: null,
      aria: `Etapy: ${tally.stages.done} z ${tally.stages.total}` },
    { id: "site-shortages", label: "Braki", value: String(tally.missing), tone: tally.missing > 0 ? "alarm" : "quiet",
      sub: tally.ordered > 0 ? `w drodze ${tally.ordered}` : null,
      aria: `Braki: ${tally.missing} do zamówienia${tally.ordered > 0 ? `, ${tally.ordered} w drodze` : ""}` },
    { id: "site-order", label: "Zamówić", value: String(tally.order), tone: tally.order > 0 ? "plain" : "quiet",
      sub: tally.order > 0 ? positionsPl(tally.order) : null,
      aria: `Do zamówienia: ${tally.order} ${positionsPl(tally.order)} kształtek` },
  ] as const;
  return (
    <nav aria-label="Stan budowy" className="grid grid-cols-3 divide-x divide-dashed divide-border rounded-card border border-border bg-muted/30" data-testid="site-tally">
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
