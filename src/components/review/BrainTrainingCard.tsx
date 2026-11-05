import { BrainCircuit, BellRing, ExternalLink } from "lucide-react";
import { SectionCard } from "@/components/ui/section-card";
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
export function BrainTrainingCard({ onRemind, hasReminder }: { onRemind: (at: number, title: string) => void; /** Dziś 1.4: czy przypomnienie na tę porę już jest. */ hasReminder?: (at: number, title: string) => boolean }) {
  useDayClock();
  const ready = useShiftsReady();
  const data = useShifts();
  if (!ready) return null;
  const plan = brainPlan(data, new Date());

  return (
    <SectionCard aria-label="Trening mózgu" data-testid="brain-training" icon={BrainCircuit} title={plan.title} description={plan.body}
      action={<>
          {plan.remindAt !== null && hasReminder?.(plan.remindAt, plan.remindLabel ?? plan.title) ? (
            <Button variant="outline" size="sm" className="coarse:h-11" disabled>
              <BellRing className="mr-1.5 h-4 w-4" aria-hidden />Przypomnienie ustawione
            </Button>
          ) : plan.remindAt !== null && (
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
      </>} />
  );
}
