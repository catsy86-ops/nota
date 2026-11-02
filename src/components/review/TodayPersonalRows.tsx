import { ChevronRight, Dumbbell, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { localDayKey } from "@/lib/dayDone";
import { useDayClock } from "@/lib/dayClock";
import { pluralPl } from "@/lib/plural";
import { takenCount } from "@/lib/supplements/model";
import { useSupplements, useSupplementsTaken } from "@/lib/supplements/store";
import { useTrainingEntries } from "@/lib/training/store";

/**
 * Plan Dziś 4.3 i 4.4: krótkie wiersze z działów osobistych — „Skrzynka: 5 do posortowania” z „Porządkuj”
 * i „Odżywki: 2 z 5 · Trening: 6 serii dziś”. Każdy tylko wtedy, gdy jest o czym mówić (Skrzynka niepusta,
 * Ćwiczenia używane). Leniwe — magazyny Ćwiczeń nie idą do paczki startowej.
 */
export function TodayPersonalRows({ inboxCount, onOpenInbox, onOpenCwiczenia }: { inboxCount: number; onOpenInbox: () => void; onOpenCwiczenia: () => void }) {
  useDayClock();
  const supplements = useSupplements();
  const taken = useSupplementsTaken();
  const entries = useTrainingEntries();
  const today = localDayKey();
  const setsToday = entries.filter((e) => e.day === today).reduce((n, e) => n + e.sets.length, 0);
  const usesCwiczenia = supplements.length > 0 || entries.length > 0;
  if (inboxCount === 0 && !usesCwiczenia) return null;

  const parts: string[] = [];
  if (supplements.length > 0) parts.push(`Odżywki: ${takenCount(supplements, taken, today)} z ${supplements.length}`);
  if (entries.length > 0) parts.push(setsToday > 0 ? `Trening: ${setsToday} ${pluralPl(setsToday, ["seria", "serie", "serii"])} dziś` : "Trening: jeszcze nie dziś");

  return (
    <section aria-label="Skrzynka i Ćwiczenia" data-testid="today-personal" className="rounded-card border border-border bg-card px-4 py-2 sm:px-5 divide-y divide-border/50">
      {inboxCount > 0 && (
        <div className="flex items-center gap-3 py-2">
          <Inbox className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="min-w-0 flex-1 text-sm">
            Skrzynka: <span className="font-mono font-semibold tabular-nums">{inboxCount}</span> do posortowania
          </p>
          <Button variant="ghost" size="sm" className="coarse:h-11" onClick={onOpenInbox}>
            Porządkuj<ChevronRight className="ml-0.5 h-4 w-4" aria-hidden />
          </Button>
        </div>
      )}
      {usesCwiczenia && (
        <button type="button" onClick={onOpenCwiczenia} className="pressable flex w-full items-center gap-3 py-2 text-left coarse:min-h-11">
          <Dumbbell className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-sm">{parts.join(" · ")}</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      )}
    </section>
  );
}
