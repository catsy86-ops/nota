import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { jobTimeline, TIMELINE_LABEL, type TimelineInput, type TimelineStep } from "@/lib/study/jobTimeline";

/**
 * R3.2 Oś zlecenia: pasek siedmiu etapów nad statusem. Stuknięcie w niezrobiony etap uruchamia
 * właściwe narzędzie (`onStep`); etap bez narzędzia w tym panelu (`actionable` go nie ma) jest tylko opisem.
 */
export function JobTimeline({ input, actionable, onStep }: {
  input: TimelineInput;
  actionable: ReadonlySet<TimelineStep>;
  onStep: (step: TimelineStep) => void;
}) {
  const steps = jobTimeline(input);
  const current = steps.find((s) => s.state === "current");
  return (
    <div data-testid="job-timeline">
      <ol className="flex gap-1" aria-label="Oś zlecenia">
        {steps.map(({ step, state }) => {
          const label = TIMELINE_LABEL[step];
          const cls = cn(
            "flex h-1.5 w-full rounded-full",
            state === "done" && "bg-primary",
            state === "current" && "bg-primary/40 ring-1 ring-primary",
            state === "skipped" && "bg-muted-foreground/30",
            state === "todo" && "bg-muted",
          );
          const title = `${label}: ${state === "done" ? "zrobione" : state === "skipped" ? "pominięte" : "do zrobienia"}`;
          const canAct = state !== "done" && actionable.has(step);
          const inner = (
            <>
              <span className={cls} aria-hidden />
              <span className="hidden max-w-full truncate text-2xs text-muted-foreground sm:block">{label}</span>
            </>
          );
          const box = "flex w-full flex-col items-center gap-1 py-1 coarse:min-h-11";
          return (
            <li key={step} className="min-w-0 flex-1" data-step={step} data-state={state}>
              {canAct
                ? <Button type="button" variant="ghost" onClick={() => onStep(step)} title={title} aria-label={title} className={cn("pressable h-auto rounded-field px-0", box)}>{inner}</Button>
                : <span title={title} aria-label={title} role="img" className={box}>{inner}</span>}
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-muted-foreground" data-testid="job-timeline-next">
        {current ? <>Następny krok: <span className="font-medium text-foreground">{TIMELINE_LABEL[current.step]}</span></> : <span className="inline-flex items-center gap-1"><Check className="size-3.5" aria-hidden />Wszystkie etapy zrobione</span>}
      </p>
    </div>
  );
}
