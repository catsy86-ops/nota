import { useEffect, useState } from "react";
import { GUIDE_EVENT, markGuideSeen, shouldAutoShow, WORK_STEPS } from "@/lib/guides";
import { GuideDialog } from "./GuideDialog";

/**
 * Przewodnik po Pracy (5 kart: wpis, karta budowy, punkty, materiał, rozliczenie). Sam z siebie
 * przy pierwszym wejściu do Pracy; potem z przycisku „?” w nagłówku Dziennika (`openGuide("work")`).
 */
export function WorkGuide() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!shouldAutoShow("work")) return;
    const t = window.setTimeout(() => setOpen(true), 600);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const on = (e: Event) => { if ((e as CustomEvent).detail === "work") { setStep(0); setOpen(true); } };
    window.addEventListener(GUIDE_EVENT, on);
    return () => window.removeEventListener(GUIDE_EVENT, on);
  }, []);

  function close() {
    markGuideSeen("work");
    setOpen(false);
    setStep(0);
  }

  return <GuideDialog open={open} label="Przewodnik po Pracy" steps={WORK_STEPS} step={step} onStep={setStep} onClose={close} doneLabel="Do roboty" testId="work-guide" />;
}
