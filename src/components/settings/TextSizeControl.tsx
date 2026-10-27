import { Button } from "@/components/ui/button";
import {
  TEXT_SIZE_LABELS,
  TEXT_SIZE_STEPS,
  DEFAULT_TEXT_SIZE_STEP,
  changeTextSize,
  resetTextSize,
  useTextSizeStep,
} from "@/lib/textSize";

/**
 * Rozmiar tekstu w Ustawieniach → Wygląd. Dwa przyciski „A” (mniejsza i większa), etykieta kroku
 * i podgląd. Podgląd jest w tym samym korzeniu co cała aplikacja, więc rośnie od razu.
 */
export function TextSizeControl() {
  const step = useTextSizeStep();
  const atMin = step === 0;
  const atMax = step === TEXT_SIZE_STEPS.length - 1;
  const isDefault = step === DEFAULT_TEXT_SIZE_STEP;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="icon" aria-label="Zmniejsz tekst" disabled={atMin} onClick={() => changeTextSize(-1)}>
          <span className="text-sm font-medium" aria-hidden>A</span>
        </Button>
        <Button type="button" variant="outline" size="icon" aria-label="Zwiększ tekst" disabled={atMax} onClick={() => changeTextSize(1)}>
          <span className="text-lg font-medium" aria-hidden>A</span>
        </Button>
        <p className="min-w-0 flex-1 text-sm" aria-live="polite">
          <span className="font-medium text-foreground">{TEXT_SIZE_LABELS[step]}</span>
          <span className="ml-2 tabular-nums text-muted-foreground">{TEXT_SIZE_STEPS[step]}%</span>
        </p>
        <Button type="button" variant="ghost" size="sm" disabled={isDefault} onClick={resetTextSize} className="coarse:h-11">
          Przywróć
        </Button>
      </div>
      <p className="rounded-field border border-border/60 bg-muted/30 px-3 py-2 text-foreground">
        Tak wygląda tekst w notatkach i listach.
      </p>
    </div>
  );
}
