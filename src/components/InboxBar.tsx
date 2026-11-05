import { useEffect, useRef, useState } from "react";
import { ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SortedStamp } from "@/components/SortedStamp";
import { PageActions } from "@/components/PageActions";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * Pasek nad listą Skrzynki (plan Skrzynki 4.2): „Do posortowania”, licznik jako `stamp-tag` i „Porządkuj”.
 * Na telefonie przykleja się pod nagłówkiem, żeby „Porządkuj” było pod ręką przy długiej liście. Od `md` pasek nie
 * jest przyklejony, więc „Porządkuj” stoi w akcjach główki (nowy plan 1.1). W DOM jest jedna kopia: ukryta klasą
 * zostawiłaby w główce niepuste miejsce na akcje, a z nim pusty rząd na telefonie.
 * 4.4: gdy licznik zejdzie do zera w tym widoku, w miejscu paska odbija się pieczątka „Posortowane”
 * (do wyjścia z widoku — komponent montuje się tylko w Skrzynce).
 */
export function InboxBar({ count, onTriage }: { count: number; onTriage: () => void }) {
  const prev = useRef(count);
  const mobile = useIsMobile();
  const [sorted, setSorted] = useState(false);
  useEffect(() => {
    if (prev.current > 0 && count === 0) setSorted(true);
    if (count > 0) setSorted(false);
    prev.current = count;
  }, [count]);

  if (count === 0) return sorted ? <SortedStamp className="self-start" /> : null;
  const triage = (
    <Button type="button" variant="outline" size="sm" className="ml-auto gap-1.5 coarse:h-11" aria-label={`Porządkuj skrzynkę (${count})`} onClick={onTriage}>
      <ListChecks className="h-4 w-4" aria-hidden /> Porządkuj
    </Button>
  );
  return (
    <>
    {!mobile && <PageActions>{triage}</PageActions>}
    <div
      data-testid="inbox-bar"
      className="flex w-full max-w-(--page-form) items-center gap-2 max-md:sticky max-md:top-(--app-header-h,0px) [html.header-hidden_&]:max-md:top-0 max-md:z-raised max-md:bg-background/95 max-md:py-1.5 max-md:backdrop-blur-xs"
    >
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Do posortowania</span>
      <span className="stamp-tag tabular-nums text-primary-ink" data-testid="inbox-count">{count}</span>
      {mobile && triage}
    </div>
    </>
  );
}
