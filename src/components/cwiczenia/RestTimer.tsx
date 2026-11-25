import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { REST_OPTIONS, restLabel, setRestSeconds, useRestSeconds } from "@/lib/training/restPrefs";
import { haptic } from "@/lib/haptics";

/** C1.2: wydzielone z `TrainingSection.tsx` bez zmian zachowania. */

/** Licznik przerwy po zapisie serii; sam się kończy, „Pomiń” kończy wcześniej. */
/** 4.4: przerwa jako pierścień (SVG) z dużym licznikiem, „+30 s” i „Pomiń”. Przy redukcji ruchu pierścień skacze co pół sekundy. */
export function RestTimer({ until, total, onExtend, onStop }: { until: number; total: number; onExtend: () => void; onStop: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, Math.ceil((until - now) / 1000));
  useEffect(() => {
    if (left !== 0) return;
    // Koniec przerwy: wibracja (jeśli telefon ją ma i jest włączona), potem zamknięcie licznika.
    haptic("success");
    onStop();
  }, [left, onStop]);

  const R = 34;
  const C = 2 * Math.PI * R;
  const fraction = Math.min(1, Math.max(0, (until - now) / 1000 / total));

  return (
    <div className="flex items-center gap-4 rounded-card border border-primary/40 px-3 py-2" data-testid="rest-timer">
      <div className="relative size-20 shrink-0">
        <svg viewBox="0 0 80 80" className="size-full -rotate-90" aria-hidden>
          <circle cx="40" cy="40" r={R} fill="none" strokeWidth="6" className="stroke-border" />
          {/* M1.4: 500 ms liniowo = odstęp tyknięcia licznika (setInterval 500 ms) — pierścień płynie bez zatrzymań. */}
          <circle cx="40" cy="40" r={R} fill="none" strokeWidth="6" strokeLinecap="round" className="stroke-primary transition-[stroke-dashoffset] duration-500 ease-linear motion-reduce:transition-none"
            strokeDasharray={C} strokeDashoffset={C * (1 - fraction)} />
        </svg>
        {/* Licznik co sekundę tylko dla oka; czytnik ogłasza wyłącznie koniec przerwy. */}
        <span className="absolute inset-0 flex items-center justify-center font-mono text-xl font-semibold tabular-nums" aria-hidden>
          {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Przerwa</p>
        <div className="mt-1 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="min-h-11" onClick={onExtend}>+30 s</Button>
          <Button variant="ghost" size="sm" className="min-h-11" onClick={onStop}>Pomiń</Button>
        </div>
      </div>
      <span role="status" className="sr-only">{left <= 0 ? "Przerwa skończona" : ""}</span>
    </div>
  );
}

/** 1.2: długość przerwy po zapisie serii. */
export function RestControl() {
  const rest = useRestSeconds();
  return (
    <div className="space-y-1.5" data-testid="rest-control">
      <p className="text-sm font-medium">Przerwa po zapisie serii</p>
      <div role="radiogroup" aria-label="Czas przerwy" className="flex flex-wrap gap-2">
        {REST_OPTIONS.map((s) => (
          <Button key={s} type="button" role="radio" aria-checked={rest === s} variant={rest === s ? "default" : "outline"} size="sm" className="coarse:h-11" onClick={() => setRestSeconds(s)}>
            {restLabel(s)}
          </Button>
        ))}
      </div>
    </div>
  );
}
