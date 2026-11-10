import { useEffect, useRef, useState } from "react";
import { Clock, Pause, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveDialogContent, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";
import { useWakeLock } from "@/hooks/useWakeLock";
import { haptic } from "@/lib/haptics";
import type { PressureTest } from "@/lib/study/pressureTest";

interface PressureTestTimerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  test: PressureTest;
  onUpdate: (test: PressureTest) => void;
}

export function PressureTestTimer({ open, onOpenChange, test, onUpdate }: PressureTestTimerProps) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [pressureInput, setPressureInput] = useState(test.bar?.toString() ?? "");
  const startTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useWakeLock(open && running);

  useEffect(() => {
    if (!running) return;
    if (!startTimeRef.current) startTimeRef.current = Date.now() - elapsed * 1000;

    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const newElapsed = Math.floor((now - startTimeRef.current!) / 1000);
      setElapsed(newElapsed);
    }, 100);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, elapsed]);

  function toggle() {
    setRunning(!running);
    haptic("tap");
  }

  function finish() {
    setRunning(false);
    const startBar = pressureInput ? Number.parseFloat(pressureInput) : test.bar;
    const minutes = Math.floor(elapsed / 60);
    onUpdate({
      ...test,
      bar: startBar ?? null,
      minutes: minutes > 0 ? minutes : null,
      readings: [{ at: 0, bar: startBar ?? 0 }],
    });
    onOpenChange(false);
  }

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const display = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="gap-0 p-0 sm:max-w-sm" data-testid="pressure-test-timer">
        <div className="border-b border-border px-5 pb-4 pt-5">
          <DialogTitle className="flex items-center gap-2 font-display text-lg">
            <Clock className="h-5 w-5 shrink-0 text-primary-ink" aria-hidden />
            Próba szczelności
          </DialogTitle>
          <DialogDescription className="text-xs">Minutnik i pomiary ciśnienia (B3.1)</DialogDescription>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="space-y-2">
            <label className="block text-xs font-medium text-muted-foreground">Ciśnienie początkowe [bar]</label>
            <input
              type="number"
              value={pressureInput}
              onChange={(e) => setPressureInput(e.target.value)}
              disabled={running}
              inputMode="decimal"
              step="0.1"
              className="w-full rounded-field border border-input bg-background px-3 py-2 text-base font-mono tabular-nums text-foreground outline-hidden focus:ring-2 focus:ring-ring disabled:opacity-60 coarse:h-11"
            />
          </div>

          <div className="rounded-card border border-border bg-muted p-4 text-center">
            <div className="font-mono text-4xl font-bold tabular-nums text-foreground">{display}</div>
            <p className="mt-1 text-xs text-muted-foreground">Upłynęło czasu</p>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant={running ? "destructive" : "default"}
              size="lg"
              onClick={toggle}
              className="flex-1 coarse:h-12"
            >
              {running ? (
                <>
                  <Pause className="mr-2 h-4 w-4" aria-hidden />
                  Pauza
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" aria-hidden />
                  Start
                </>
              )}
            </Button>
          </div>
        </div>

        <ResponsiveDialogFooter className="grid grid-cols-2 gap-2 border-t border-border px-5 pb-5 pt-4">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="coarse:h-11">
            <X className="mr-1 h-4 w-4" aria-hidden />
            Anuluj
          </Button>
          <Button type="button" onClick={finish} disabled={elapsed === 0} className="coarse:h-11">
            Zapisz
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </Dialog>
  );
}
