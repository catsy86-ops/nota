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
    <aside aria-label="Podpowiedź: Grafik" data-testid="shifts-hint" className="flex items-start gap-3 rounded-card border border-primary/40 bg-primary/10 p-3 text-sm">
      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary-ink" aria-hidden />
      <p className="min-w-0 flex-1 leading-relaxed">
        <span className="font-semibold">Pierwszy raz w Grafiku?</span> Wybierz zmianę na palecie, potem {TAP.toLowerCase()} dni w kalendarzu,
        a zmiana się naniesie. Powtarzalny układ (np. 4 dni pracy, 4 wolne) ustawisz przyciskiem „Cykl”. Podsumowanie niżej liczy godziny i zarobek.
      </p>
      <button type="button" onClick={close} aria-label="Zamknij podpowiedź" className="pressable -m-1 grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground coarse:size-11">
        <X className="h-4 w-4" aria-hidden />
      </button>
    </aside>
  );
}
