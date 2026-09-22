import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SEEN_KEY = "kaczy.tour.seen.v1";

const STEPS = [
  {
    emoji: "📝",
    title: "Zapisz myśl w sekundę",
    desc: "Kliknij pole „Nowa notatka” na górze (lub duży przycisk + na dole) i po prostu pisz. Zapisuje się samo.",
  },
  {
    emoji: "🔍",
    title: "Znajdź wszystko",
    desc: "Wyszukiwarka u góry przeszukuje tytuły i treść. Etykiety i foldery w panelu po lewej pomagają uporządkować notatki.",
  },
  {
    emoji: "🗂️",
    title: "Nic nie ginie",
    desc: "Notatki możesz przypiąć, przenieść do archiwum albo do kosza — z kosza wracają jednym kliknięciem przez 30 dni.",
  },
];

export function OnboardingTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!localStorage.getItem(SEEN_KEY)) {
      const t = setTimeout(() => setOpen(true), 700);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    function onTour() { setStep(0); setOpen(true); }
    window.addEventListener("kaczy:tour", onTour);
    return () => window.removeEventListener("kaczy:tour", onTour);
  }, []);

  function finish() {
    localStorage.setItem(SEEN_KEY, "1");
    setOpen(false);
    setStep(0);
  }

  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) finish(); }}>
      <DialogContent className="max-w-sm rounded-3xl text-center">
        <DialogHeader className="items-center space-y-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={s.emoji}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="text-5xl"
            >
              {s.emoji}
            </motion.div>
          </AnimatePresence>
          <DialogTitle className="font-display text-xl">{s.title}</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">{s.desc}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center gap-1.5 py-2">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === step ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
              )}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" className="flex-1" onClick={finish}>
            {last ? "Zamknij" : "Pomiń"}
          </Button>
          <Button className="flex-1" onClick={() => (last ? finish() : setStep(step + 1))}>
            {last ? "Zaczynamy 🦆" : "Dalej"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
