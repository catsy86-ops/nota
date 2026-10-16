import { useState } from "react";
import { Check, ListChecks, Plus, X } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { toastWithUndo } from "@/lib/undoToast";
import { setSiteStages } from "@/lib/study/store";
import type { SiteInfo } from "@/lib/study/sites";
import { addStage, removeStage, siteStages, stageProgress, STAGE_NAME_MAX, STAGES_MAX, toggleStage } from "@/lib/study/stages";

const shortDate = (at: number) => new Date(at).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" });

/**
 * Etapy budowy w karcie: odhaczenie zapisuje datę, pasek pokazuje postęp, a „Następny” — co
 * zostało. Własne etapy dopisuje się na końcu; usunięcie ma „Cofnij”. Lista trafia do raportu.
 */
export function SiteStagesPanel({ site }: { site: SiteInfo }) {
  const stages = siteStages(site);
  const { done, total, next } = stageProgress(stages);
  const [name, setName] = useState("");
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  function toggle(id: string) {
    const next = toggleStage(stages, id, Date.now());
    const nowDone = next.find((s) => s.id === id)?.done !== undefined;
    haptic(nowDone ? "success" : "tap");
    setSiteStages(site.id, next, stages);
  }

  function remove(id: string) {
    const before = stages;
    const after = removeStage(stages, id);
    const label = stages.find((s) => s.id === id)?.name ?? "etap";
    setSiteStages(site.id, after, before);
    toastWithUndo(`Usunięto etap „${label}”`, () => setSiteStages(site.id, before, after));
  }

  function add() {
    const after = addStage(stages, name);
    if (after.length === stages.length) return;
    setSiteStages(site.id, after, stages);
    setName("");
    haptic("tap");
  }

  return (
    <section aria-label="Etapy budowy" data-testid="site-stages" className="space-y-2 rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <ListChecks className="h-3.5 w-3.5" aria-hidden />Etapy
        </h3>
        <span className="font-mono text-xs tabular-nums text-muted-foreground" data-testid="site-stages-progress">{done}/{total}</span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Postęp budowy"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
      >
        <div className="h-full rounded-full bg-success transition-[width] duration-base" style={{ width: `${pct}%` }} />
      </div>
      {next && <p className="text-xs text-muted-foreground">Następny: <span className="text-foreground">{next.name}</span></p>}

      <ul className="space-y-0.5">
        {stages.map((s) => {
          const isDone = s.done !== undefined;
          return (
            <li key={s.id} className="flex items-center gap-1">
              <button
                type="button"
                role="checkbox"
                aria-checked={isDone}
                onClick={() => toggle(s.id)}
                className="pressable flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left text-sm hover:bg-muted coarse:min-h-11"
              >
                <span
                  aria-hidden
                  className={cn(
                    "grid size-5 shrink-0 place-items-center rounded-md border",
                    isDone ? "border-success bg-success text-success-foreground" : "border-border bg-background",
                  )}
                >
                  {isDone && <Check className="h-3.5 w-3.5" />}
                </span>
                <span className={cn("min-w-0 flex-1 truncate", isDone && "text-muted-foreground line-through decoration-muted-foreground/50")}>{s.name}</span>
                {isDone && <span className="shrink-0 font-mono text-2xs tabular-nums text-muted-foreground">{shortDate(s.done!)}</span>}
              </button>
              <button
                type="button"
                onClick={() => remove(s.id)}
                aria-label={`Usuń etap: ${s.name}`}
                className="pressable grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground coarse:size-11"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>

      {stages.length < STAGES_MAX && (
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={STAGE_NAME_MAX}
            placeholder="Własny etap, np. Kocioł i grzejniki"
            aria-label="Nowy etap"
            autoComplete="off"
            className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 text-base outline-hidden focus:ring-2 focus:ring-ring coarse:h-11 sm:text-sm"
          />
          <button
            type="submit"
            disabled={!name.trim()}
            className="pressable inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-3 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50 coarse:min-h-11"
          >
            <Plus className="h-4 w-4" aria-hidden />Dodaj
          </button>
        </form>
      )}
    </section>
  );
}
