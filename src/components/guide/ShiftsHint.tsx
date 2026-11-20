import { Button } from "@/components/ui/button";
import { cardVariant } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Lightbulb, X } from "lucide-react";
import { markGuideSeen, shouldAutoShow } from "@/lib/guides";
import { TAP } from "@/lib/platform";

/** Jednorazowa podpowiedź przy pierwszym wejściu do Grafiku: jak nanosić zmiany. Znika na zawsze po zamknięciu. */
export function ShiftsHint() {
  const [show, setShow] = useState(() => shouldAutoShow("shifts-hint"));
  if (!show) return null;
  const close = () => { markGuideSeen("shifts-hint"); setShow(false); };
  return (
    <aside aria-label="Podpowiedź: Grafik" data-testid="shifts-hint" className={cn(cardVariant("status", "info"), "flex items-start gap-3 bg-primary/10 p-3 text-sm")}>
      <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary-ink" aria-hidden />
      <p className="min-w-0 flex-1 leading-relaxed">
        <span className="font-semibold">Pierwszy raz w Grafiku?</span> Wybierz zmianę na palecie, potem {TAP.toLowerCase()} dni w kalendarzu,
        a zmiana się naniesie. Powtarzalny układ (np. 4 dni pracy, 4 wolne) ustawisz przyciskiem „Cykl”. Podsumowanie niżej liczy godziny i zarobek.
      </p>
      <Button type="button" onClick={close} aria-label="Zamknij podpowiedź" variant="ghost" size="icon-sm" className="-m-1 rounded-full text-muted-foreground">
        <X className="size-4" aria-hidden />
      </Button>
    </aside>
  );
}
