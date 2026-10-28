import { cn } from "@/lib/utils";
import { stageProgress, type SiteStage } from "@/lib/study/stages";

/**
 * P5.1: etapy budowy jako linia postępu z kropkami — zrobione wypełnione, następny z obwódką,
 * reszta wyciszona — i licznik „3/7”. Nazwy są w etykiecie (czytnik) i w podpowiedzi po najechaniu.
 */
export function StageDots({ stages, onDark = false }: { stages: readonly SiteStage[]; onDark?: boolean }) {
  if (stages.length === 0) return null;
  const p = stageProgress(stages);
  const label = `Etapy: ${p.done} z ${p.total}${p.next ? `, następny: ${p.next.name}` : ""}`;
  return (
    <div className="flex items-center gap-2" role="img" aria-label={label} data-testid="site-stage-dots">
      <ol className="relative flex flex-1 items-center justify-between" aria-hidden>
        <span className={cn("absolute inset-x-1 top-1/2 h-px -translate-y-1/2", onDark ? "bg-white/40" : "bg-border")} />
        {stages.map((s) => {
          const done = s.done !== undefined;
          const next = p.next?.id === s.id;
          return (
            <li key={s.id} title={s.name}
              className={cn("relative size-2.5 rounded-full border-2",
                done ? "border-success-ink bg-success-ink" : next ? (onDark ? "border-white bg-transparent" : "border-primary-ink bg-background") : onDark ? "border-white/50 bg-white/20" : "border-border bg-muted")} />
          );
        })}
      </ol>
      <span className={cn("shrink-0 font-mono text-xs tabular-nums", onDark ? "text-white/90" : "text-muted-foreground")}>{p.done}/{p.total}</span>
    </div>
  );
}
