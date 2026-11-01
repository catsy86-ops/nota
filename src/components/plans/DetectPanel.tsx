import { LoaderCircle, Pipette, Plus, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { lengthLabel, measureRoute } from "@/lib/plans/geometry";
import type { SystemType } from "@/lib/plans/model";
import { cn } from "@/lib/utils";
import { SystemSelect } from "./PlanPanel";

/** Propozycja trasy z obrazu — żyje w edytorze; do analizy trafia po „Dodaj” jako trasa do weryfikacji. */
export interface RouteProposal {
  id: string;
  pts: number[];
  confidence: number;
}

export type DetectRun = { state: "idle" } | { state: "running" } | { state: "error"; message: string };

const sectionCls = "space-y-2 border-b border-border/60 px-3 py-3 last:border-b-0";
const h3 = "text-xs font-semibold uppercase tracking-wider text-muted-foreground";
const pct = (v: number) => `${Math.round(v * 100)}%`;

export function DetectSection({ picking, onPick, color, tolerance, onTolerance, system, onSystem, run, proposals, mpp, focusId, onFocus, onDetect, onAdd, onReject, onAddAll }: {
  picking: boolean;
  onPick: (on: boolean) => void;
  color: string | null;
  tolerance: number;
  onTolerance: (v: number) => void;
  system: SystemType;
  onSystem: (s: SystemType) => void;
  run: DetectRun;
  proposals: readonly RouteProposal[];
  mpp: number | null;
  focusId: string | null;
  onFocus: (id: string | null) => void;
  onDetect: () => void;
  onAdd: (p: RouteProposal) => void;
  onReject: (id: string) => void;
  onAddAll: () => void;
}) {
  return (
    <section className={sectionCls} aria-label="Propozycje tras" data-testid="plan-detect">
      <h3 className={cn(h3, "flex items-center gap-1.5")}><Sparkles className="h-3.5 w-3.5" aria-hidden />Propozycje tras <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.65rem] normal-case tracking-normal">eksperymentalne</span></h3>
      <p className="text-xs text-muted-foreground">Wskaż pipetą kolor rury na planie — program poszuka linii w tym kolorze. Ściany, wymiary i opisy w innych kolorach pomija; każdą propozycję sprawdź przed dodaniem.</p>
      <div className="flex items-center gap-2">
        <Button type="button" variant={picking ? "default" : "outline"} onClick={() => onPick(!picking)} aria-pressed={picking} className="pressable flex-1 coarse:h-11">
          <Pipette className="mr-1.5 h-4 w-4" aria-hidden />{picking ? "Stuknij rurę na planie" : color ? "Zmień kolor" : "Wskaż kolor rury"}
        </Button>
        {color && <span className="h-9 w-9 shrink-0 rounded-control border border-border" style={{ backgroundColor: color }} title={color} data-testid="plan-detect-color" />}
      </div>
      {color && (
        <>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Instalacja dla tego koloru</span>
            <SystemSelect value={system} onChange={onSystem} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="flex justify-between font-medium"><span>Tolerancja koloru</span><span className="font-mono text-xs tabular-nums text-muted-foreground">{pct(tolerance)}</span></span>
            <input type="range" min={0.05} max={0.6} step={0.05} value={tolerance} onChange={(e) => onTolerance(Number(e.target.value))} className="w-full accent-[var(--primary)]" />
          </label>
          <Button type="button" onClick={onDetect} disabled={run.state === "running"} className="pressable w-full coarse:h-11">
            {run.state === "running" ? <><LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />Szukam tras…</> : "Szukaj tras"}
          </Button>
        </>
      )}
      {run.state === "error" && <p role="alert" className="text-sm text-destructive-ink">{run.message}</p>}
      {proposals.length > 0 && (
        <div className="space-y-1.5" data-testid="plan-detect-proposals">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Znalezione ({proposals.length})</p>
            <Button type="button" variant="ghost" onClick={onAddAll} className="pressable h-9 px-2 text-xs coarse:h-11">Dodaj wszystkie</Button>
          </div>
          <ul className="space-y-0.5">
            {proposals.map((p, i) => (
              <li key={p.id} className={cn("flex items-center gap-1 rounded-control px-1.5", focusId === p.id && "bg-primary/10")}
                onMouseEnter={() => onFocus(p.id)} onMouseLeave={() => onFocus(null)} onFocusCapture={() => onFocus(p.id)}>
                <span className="min-w-0 flex-1 truncate py-1.5 text-sm">
                  Propozycja {i + 1} · <span className="font-mono tabular-nums">{lengthLabel(measureRoute({ pts: p.pts, verified: false }, mpp)).replace(" (bez skali)", "")}</span>
                  <span className="text-xs text-muted-foreground"> · pewność {pct(p.confidence)}</span>
                </span>
                <button type="button" onClick={() => onAdd(p)} aria-label={`Dodaj propozycję ${i + 1}`}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-primary-ink hover:bg-primary/10 outline-hidden focus-visible:ring-2 focus-visible:ring-ring coarse:h-11 coarse:w-11">
                  <Plus className="h-4 w-4" aria-hidden />
                </button>
                <button type="button" onClick={() => onReject(p.id)} aria-label={`Odrzuć propozycję ${i + 1}`}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-muted-foreground hover:bg-muted outline-hidden focus-visible:ring-2 focus-visible:ring-ring coarse:h-11 coarse:w-11">
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">Dodane trasy są „do weryfikacji” (linia przerywana) — zatwierdź je w panelu trasy po sprawdzeniu.</p>
        </div>
      )}
    </section>
  );
}
