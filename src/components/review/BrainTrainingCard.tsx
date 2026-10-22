import { BrainCircuit, BellRing, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDayClock } from "@/lib/dayClock";
import { toast } from "sonner";
import { brainPlan, NEUROKLIK_URL } from "@/lib/brainTraining";
import { useShifts, useShiftsReady } from "@/lib/shifts";

/**
 * Karta „Trening mózgu” na stronie Dziś: podpowiedź względem dzisiejszej zmiany z Grafiku
 * (przed pracą / po pracy), przycisk otwarcia Neuroklik i przypomnienie na właściwą porę.
 * Leniwa — nie dokłada się do paczki startowej.
 */
export function BrainTrainingCard({ onRemind }: { onRemind: (at: number, title: string) => void }) {
  useDayClock();
  const ready = useShiftsReady();
  const data = useShifts();
  if (!ready) return null;
  const plan = brainPlan(data, new Date());

  return (
    <section aria-label="Trening mózgu" data-testid="brain-training" className="rounded-card border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <BrainCircuit className="mt-0.5 h-4 w-4 shrink-0 text-primary-ink" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-medium sm:text-base">{plan.title}</p>
            <p className="text-xs text-muted-foreground">{plan.body}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {plan.remindAt !== null && (
            <Button
              variant="outline"
              size="sm"
              className="coarse:h-11"
              onClick={() => {
                onRemind(plan.remindAt!, plan.remindLabel ?? plan.title);
                toast.success("Ustawiono przypomnienie", { description: plan.remindLabel ?? undefined });
              }}
            >
              <BellRing className="mr-1.5 h-4 w-4" aria-hidden />Przypomnij
            </Button>
          )}
          <Button size="sm" className="coarse:h-11" onClick={() => window.open(NEUROKLIK_URL, "_blank", "noopener,noreferrer")}>
            <ExternalLink className="mr-1.5 h-4 w-4" aria-hidden />Otwórz trening
          </Button>
        </div>
      </div>
    </section>
  );
}
