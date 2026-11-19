import { useMemo, useState } from "react";
import { CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/haptics";
import { amountText } from "@/lib/debts/hideAmounts";
import type { PersonDebts } from "@/lib/debts/model";
import { planState } from "@/lib/debts/plans";
import { payDebtRate, useDebtPlans } from "@/lib/debts/store";
import { cn } from "@/lib/utils";
import { cardVariant } from "@/components/ui/card";

const plDay = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}.${day.slice(0, 4)}`;

/**
 * L2.1 Raty w arkuszu osoby: „rata 2 z 6 · 200 zł”, wpłacona część, zaległe i „Rata wpłacona”. Stan wyprowadzony
 * ze wszystkich wpisów (`planState`), więc spłata wpisana ręcznie liczy się tak samo jak przycisk.
 */
export function DebtPlans({ person, hidden }: { person: PersonDebts; hidden: boolean }) {
  const plans = useDebtPlans();
  const [busy, setBusy] = useState<string | null>(null);
  const mine = useMemo(() => {
    const ids = new Set(person.entries.map((e) => e.id));
    return plans.filter((p) => ids.has(p.entryId)).map((p) => ({ plan: p, state: planState(p, person.entries) }));
  }, [plans, person]);
  if (mine.length === 0) return null;

  const pay = (planId: string) => {
    setBusy(planId);
    try {
      const paid = payDebtRate(planId);
      if (!paid) { haptic("warn"); toast.error("Nie udało się zapisać raty"); return; }
      haptic("success");
      toast.success(`Rata ${paid.k} z ${paid.count}: ${amountText(paid.entry.amount, hidden)}`, { action: { label: "Cofnij", onClick: paid.undo } });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-label="Raty" className="mt-4 space-y-2" data-testid="debt-plans">
      {mine.map(({ plan, state }) => state && (
        <div key={plan.id} className={cn(cardVariant("inset"), "p-3 text-sm")}>
          <p className="flex items-center gap-2 font-medium">
            <CalendarClock className="size-4 text-muted-foreground" aria-hidden />
            {state.finished
              ? `Raty spłacone (${plan.count} z ${plan.count})`
              : <span data-testid="debt-plan-next">Rata {state.next!.k} z {plan.count} · {amountText(state.next!.amount, hidden)} · do {plDay(state.next!.due)}</span>}
          </p>
          {!state.finished && state.partial > 0 && (
            <p className="mt-1 text-muted-foreground">Wpłacono {amountText(state.partial, hidden)} z {amountText(state.next!.amount, hidden)}</p>
          )}
          {state.overdue > 0 && (
            <p className="mt-1 text-warning-ink" data-testid="debt-plan-overdue">Zaległe raty: {state.overdue}</p>
          )}
          {!state.finished && (
            <Button size="sm" variant="outline" className="mt-2 h-11 w-full" disabled={busy === plan.id} onClick={() => pay(plan.id)}>
              Rata wpłacona ({amountText(state.next!.toPay, hidden)})
            </Button>
          )}
        </div>
      ))}
    </section>
  );
}
