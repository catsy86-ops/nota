import { useEffect, useRef } from "react";
import { Minus, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const HM = /^([01]?\d|2[0-3]):[0-5]\d$/;
const STEP = 15;
const DAY = 24 * 60;

const pad = (n: number) => String(n).padStart(2, "0");

/** „HH:MM” ± `delta` minut, zawijane przez północ. */
export function shiftTime(hm: string, delta: number): string {
  const [h, m] = hm.split(":").map(Number);
  const t = (((h * 60 + m + delta) % DAY) + DAY) % DAY;
  return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
}

interface TimeStepperProps {
  id: string;
  label: string;
  value: string;
  onChange: (hm: string) => void;
  invalid?: boolean;
}

/**
 * Pole godziny z przyciskami −/+ o 15 minut. Szybkie klikanie zmienia czas
 * o kolejne kwanta, a przytrzymanie przycisku powtarza zmianę (jak w liczniku) —
 * dla kogoś, kto poprawia godzinę o pół godziny, to szybciej niż okno wyboru czasu.
 */
export function TimeStepper({ id, label, value, onChange, invalid }: TimeStepperProps) {
  // Najświeższa wartość dla powtarzania — przy przytrzymaniu `value` zmienia się co tyknięcie.
  const latest = useRef(value);
  latest.current = value;
  const timers = useRef<{ start?: number; repeat?: number }>({});

  const stop = () => {
    window.clearTimeout(timers.current.start);
    window.clearInterval(timers.current.repeat);
    timers.current = {};
  };
  useEffect(() => stop, []);

  function bump(dir: 1 | -1) {
    const base = HM.test(latest.current) ? latest.current : "08:00";
    const next = shiftTime(base, dir * STEP);
    latest.current = next;
    onChange(next);
  }

  function press(dir: 1 | -1) {
    stop();
    bump(dir);
    // Po krótkim wahaniu zaczyna się powtarzanie, żeby pojedyncze kliknięcie dawało dokładnie jeden krok.
    timers.current.start = window.setTimeout(() => {
      timers.current.repeat = window.setInterval(() => bump(dir), 90);
    }, 400);
  }

  const btn = "pressable h-10 w-9 coarse:h-11 coarse:w-11 shrink-0 flex items-center justify-center rounded-md border border-input bg-background text-muted-foreground hover:text-foreground hover:bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring touch-manipulation select-none";

  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-1">
        <button type="button" className={btn} aria-label={`${label}: ${STEP} minut wcześniej`}
          onPointerDown={(e) => { e.preventDefault(); press(-1); }} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); bump(-1); } }}>
          <Minus className="w-4 h-4" />
        </button>
        <Input id={id} type="time" step={60 * STEP} value={value} aria-invalid={invalid || undefined}
          onChange={(e) => onChange(e.target.value)} className="min-w-0 text-center tabular-nums" />
        <button type="button" className={btn} aria-label={`${label}: ${STEP} minut później`}
          onPointerDown={(e) => { e.preventDefault(); press(1); }} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); bump(1); } }}>
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
