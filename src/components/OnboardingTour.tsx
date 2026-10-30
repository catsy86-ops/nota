import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { INTERESTS, TOUR_SEEN_KEY, tourSteps, WELCOME_STEP, type Interest } from "@/lib/guides";
import { GuideDialog } from "@/components/guide/GuideDialog";

/**
 * Samouczek na start (pierwsze uruchomienie i „Więcej → Samouczek”): karta powitalna z wyborem działów,
 * potem karty Notatek, wybranych działów i kopii. Treść w `lib/guides.ts`.
 */
export function OnboardingTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [interests, setInterests] = useState<Set<Interest>>(() => new Set(INTERESTS.map((i) => i.id)));
  const steps = useMemo(() => [WELCOME_STEP, ...tourSteps(interests)], [interests]);

  useEffect(() => {
    let seen = true;
    try { seen = !!localStorage.getItem(TOUR_SEEN_KEY); } catch { /* prywatne okno — nie pokazuj */ }
    if (seen) return;
    const t = setTimeout(() => setOpen(true), 700);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    function onTour() { setStep(0); setOpen(true); }
    window.addEventListener("kaczy:tour", onTour);
    return () => window.removeEventListener("kaczy:tour", onTour);
  }, []);

  function close() {
    try { localStorage.setItem(TOUR_SEEN_KEY, "1"); } catch { /* prywatne okno */ }
    setOpen(false);
    setStep(0);
  }

  function flip(id: Interest) {
    setInterests((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const choose = step === 0 && (
    <div className="flex flex-wrap justify-center gap-1.5" role="group" aria-label="Co Cię interesuje">
      <span className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-3 py-1 text-sm font-medium coarse:min-h-11">
        <Check className="h-3.5 w-3.5" aria-hidden />Notatki
      </span>
      {INTERESTS.map((i) => {
        const on = interests.has(i.id);
        return (
          <button key={i.id} type="button" onClick={() => flip(i.id)} aria-pressed={on}
            className={cn("pressable inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm coarse:min-h-11",
              on ? "border-primary bg-primary/10 font-medium text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
            {on && <Check className="h-3.5 w-3.5" aria-hidden />}{i.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <GuideDialog
      open={open}
      label="Samouczek"
      steps={steps}
      step={step}
      onStep={setStep}
      onClose={close}
      extra={choose || undefined}
      doneLabel="Zaczynamy"
      testId="onboarding-tour"
    />
  );
}
