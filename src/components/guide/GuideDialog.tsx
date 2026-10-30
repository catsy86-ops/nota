import { useRef, type ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GuideStep } from "@/lib/guides";
import { GuideArt } from "./GuideArt";

const PHONE_QUERY = "(max-width: 767px)";

/**
 * Okno przewodnika: ilustracja, tytuł, opis, kropki (stuknięcie = skok do karty), Wstecz/Dalej.
 * Strzałki na klawiaturze i przesunięcie palcem w bok zmieniają kartę. Stan karty trzyma wywołujący.
 */
export function GuideDialog({ open, label, steps, step, onStep, onClose, extra, doneLabel = "Gotowe", testId }: {
  open: boolean;
  /** Nazwa przewodnika dla czytnika ekranu, np. „Samouczek”. */
  label: string;
  steps: readonly GuideStep[];
  step: number;
  onStep: (i: number) => void;
  /** `true` = przeszedł do końca, `false` = pominął albo zamknął. */
  onClose: (finished: boolean) => void;
  /** Dodatkowa treść pod opisem bieżącej karty (wybór działów, link do innego przewodnika). */
  extra?: ReactNode;
  doneLabel?: string;
  testId?: string;
}) {
  const phone = typeof matchMedia !== "undefined" && matchMedia(PHONE_QUERY).matches;
  const s = steps[Math.min(step, steps.length - 1)];
  const first = step === 0;
  const last = step >= steps.length - 1;
  const touch = useRef<{ x: number; y: number } | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const go = (i: number) => { if (i >= 0 && i < steps.length) onStep(i); };
  const next = () => (last ? onClose(true) : go(step + 1));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(false); }}>
      <DialogContent
        className="max-w-sm rounded-card text-center"
        aria-roledescription="przewodnik"
        data-testid={testId}
        // Fokus na „Dalej”, nie na pierwszej kropce — Enter prowadzi przez przewodnik.
        onOpenAutoFocus={(e) => { if (!extra) { e.preventDefault(); nextRef.current?.focus(); } }}
        onKeyDown={(e) => {
          if (e.target instanceof HTMLInputElement) return;
          if (e.key === "ArrowRight") { e.preventDefault(); go(step + 1); }
          if (e.key === "ArrowLeft") { e.preventDefault(); go(step - 1); }
        }}
        onPointerDown={(e) => { if (e.pointerType !== "mouse") touch.current = { x: e.clientX, y: e.clientY }; }}
        onPointerUp={(e) => {
          const t = touch.current;
          touch.current = null;
          if (!t) return;
          const dx = e.clientX - t.x, dy = e.clientY - t.y;
          if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) go(step + (dx < 0 ? 1 : -1));
        }}
      >
        <p className="sr-only" aria-live="polite">{`${label}: karta ${step + 1} z ${steps.length}`}</p>
        <DialogHeader className="items-center space-y-3">
          <GuideArt key={s.id} art={s.art} chip={s.chip} />
          <DialogTitle className="font-display text-xl">{s.title}</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">{(phone && s.phone) || s.desc}</DialogDescription>
        </DialogHeader>
        {extra}

        <div className="flex items-center justify-center gap-0.5" role="group" aria-label="Karty przewodnika">
          {steps.map((x, i) => (
            <button
              key={x.id}
              type="button"
              onClick={() => go(i)}
              aria-label={`Karta ${i + 1}: ${x.title}`}
              aria-current={i === step ? "step" : undefined}
              className="pressable grid h-6 place-items-center px-1 coarse:h-11"
            >
              <span className={cn("block h-1.5 rounded-full transition-all duration-300 motion-reduce:transition-none", i === step ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30")} />
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {first ? (
            <Button variant="ghost" className="flex-1" onClick={() => onClose(false)}>Pomiń</Button>
          ) : (
            <Button variant="ghost" className="flex-1" onClick={() => go(step - 1)}><ChevronLeft className="h-4 w-4" aria-hidden />Wstecz</Button>
          )}
          <Button ref={nextRef} className="flex-1" onClick={next}>{last ? doneLabel : "Dalej"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
