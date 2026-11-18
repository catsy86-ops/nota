import { CalendarClock, ChevronRight, Dumbbell, Inbox } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { localDayKey } from "@/lib/dayDone";
import { useDayClock } from "@/lib/dayClock";
import { pluralPl } from "@/lib/plural";
import { takenCount } from "@/lib/supplements/model";
import { useSupplements, useSupplementsTaken } from "@/lib/supplements/store";
import { useTrainingEntries } from "@/lib/training/store";
import { cardClass } from "@/components/ui/card";
import { haptic } from "@/lib/haptics";
import { amountText, useHideAmounts } from "@/lib/debts/hideAmounts";
import { overdueRates } from "@/lib/debts/plans";
import { payDebtRate, useDebtPlans, useDebts } from "@/lib/debts/store";

/**
 * Plan Dziś 4.3 i 4.4: krótkie wiersze z działów osobistych — „Skrzynka: 5 do posortowania” z „Porządkuj”
 * i „Odżywki: 2 z 5 · Trening: 6 serii dziś”. Każdy tylko wtedy, gdy jest o czym mówić (Skrzynka niepusta,
 * Ćwiczenia używane). Leniwe — magazyny Ćwiczeń nie idą do paczki startowej.
 */
export function TodayPersonalRows({ inboxCount, onOpenInbox, onOpenCwiczenia, onOpenDebts }: { inboxCount: number; onOpenInbox: () => void; onOpenCwiczenia: () => void; onOpenDebts?: () => void }) {
  useDayClock();
  const supplements = useSupplements();
  const taken = useSupplementsTaken();
  const entries = useTrainingEntries();
  const today = localDayKey();
  const setsToday = entries.filter((e) => e.day === today).reduce((n, e) => n + e.sets.length, 0);
  const usesCwiczenia = supplements.length > 0 || entries.length > 0;
  // L2.4: zaległe raty. Pojedynczy termin zwrotu już jest na Dziś jako zaległa notatka `długi` — tu tylko raty,
  // bo notatka serii idzie dalej po „Gotowe” i zaległość widać wyłącznie ze stanu planu.
  const debts = useDebts();
  const plans = useDebtPlans();
  const hidden = useHideAmounts();
  const late = overdueRates(plans, debts, today);
  if (inboxCount === 0 && !usesCwiczenia && late.length === 0) return null;
  const pay = (planId: string) => {
    const paid = payDebtRate(planId);
    if (!paid) { haptic("warn"); toast.error("Nie udało się zapisać raty"); return; }
    haptic("success");
    toast.success(`Rata ${paid.k} z ${paid.count}: ${amountText(paid.entry.amount, hidden)}`, { action: { label: "Cofnij", onClick: paid.undo } });
  };

  const parts: string[] = [];
  if (supplements.length > 0) parts.push(`Odżywki: ${takenCount(supplements, taken, today)} z ${supplements.length}`);
  if (entries.length > 0) parts.push(setsToday > 0 ? `Trening: ${setsToday} ${pluralPl(setsToday, ["seria", "serie", "serii"])} dziś` : "Trening: jeszcze nie dziś");

  return (
    <section aria-label="Skrzynka, Ćwiczenia i raty" data-testid="today-personal" className={`${cardClass} px-4 py-2 sm:px-5 divide-y divide-border/50`}>
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
      {late.map((r) => (
        <div key={r.planId} className="flex items-center gap-3 py-2" data-testid="today-debt-rate">
          <CalendarClock className="h-4 w-4 shrink-0 text-warning-ink" aria-hidden />
          <button type="button" className="min-w-0 flex-1 truncate text-left text-sm" onClick={onOpenDebts}>
            {r.person}: rata {r.k} z {r.count} · {amountText(r.toPay, hidden)}, {r.daysLate} {pluralPl(r.daysLate, ["dzień", "dni", "dni"])} po terminie
          </button>
          <Button variant="ghost" size="sm" className="coarse:h-11" onClick={() => pay(r.planId)}>Wpłacona</Button>
        </div>
      ))}
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
