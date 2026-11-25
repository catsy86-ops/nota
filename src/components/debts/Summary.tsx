import { Stat } from "@/components/ui/stat";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { amountText } from "@/lib/debts/hideAmounts";
import { formatAmount } from "@/lib/debts/model";
import { cardVariant } from "@/components/ui/card";

/** L4.2: liczby bieżącego miesiąca (`monthNumbers`); `null` — w tym miesiącu nie ma wpisów. */
type MonthNumbers = { lent: number; repaid: number; change: number } | null;

export function Summary({ owedToMe, iOwe, hidden, month }: { owedToMe: number; iOwe: number; hidden: boolean; month?: MonthNumbers }) {
  const total = owedToMe + iOwe;
  const owedShare = total > 0 ? Math.round((owedToMe / total) * 100) : 0;
  // Kwota przelicza się płynnie (4.1); przy ukrytych kwotach — „•••” bez animacji.
  const money = (v: number, testId: string) => hidden
    ? <span data-testid={testId}>{amountText(v, true)}</span>
    : <AnimatedNumber value={v} format={formatAmount} data-testid={testId} />;
  return (
    // Liczby przez `Stat` (nowy plan 2.3): ten sam wygląd co w Grafiku i Pracy.
    <div className={cn(cardVariant("raised"), "p-card")} role="group" aria-label="Podsumowanie">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Są nam winni" value={money(owedToMe, "debts-owed")} tone="success" />
        <Stat label="Jesteś winien" value={money(iOwe, "debts-owe")} tone="warning" align="end" />
      </div>
      {total > 0 && (
        // 4.1: proporcja w jednym pasku — lewa część „nam winni”, prawa „Ty winien”.
        <div className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={`Proporcja: ${owedShare}% to, co nam winni, ${100 - owedShare}% to, co jesteś winien`} data-testid="debts-ratio">
          {owedToMe > 0 && <div className="h-full rounded-full bg-success transition-[flex-grow] duration-slow motion-reduce:transition-none" style={{ flexGrow: owedToMe }} />}
          {iOwe > 0 && <div className="h-full rounded-full bg-warning transition-[flex-grow] duration-slow motion-reduce:transition-none" style={{ flexGrow: iOwe }} />}
        </div>
      )}
      {month && (
        // Zwinięte domyślnie: podsumowanie zostaje dwiema liczbami, miesiąc jest na żądanie.
        <details className="group mt-3 border-t border-border/60 pt-2" data-testid="debts-month">
          <summary className="tap-target flex cursor-pointer list-none items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
            Ten miesiąc w liczbach
            <ChevronDown className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
          </summary>
          <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
            <MonthCell label="Pożyczone" value={amountText(month.lent, hidden)} />
            <MonthCell label="Oddane" value={amountText(month.repaid, hidden)} />
            <MonthCell label="Zmiana salda" value={hidden ? amountText(month.change, true) : `${month.change > 0 ? "+" : month.change < 0 ? "−" : ""}${formatAmount(Math.abs(month.change))}`} end />
          </dl>
        </details>
      )}
    </div>
  );
}

function MonthCell({ label, value, end }: { label: string; value: string; end?: boolean }) {
  return (
    <div className={cn("min-w-0", end && "text-end")}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
