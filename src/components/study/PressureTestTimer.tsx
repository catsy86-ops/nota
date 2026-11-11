import { useEffect, useState } from "react";
import { Clock, Play, Square, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveDialogContent, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";
import { useWakeLock } from "@/hooks/useWakeLock";
import { haptic } from "@/lib/haptics";
import { requestNotificationPermissionOnIntent } from "@/lib/notificationPermission";
import { parseAmount } from "@/lib/study/billing";
import {
  addReading, cancelRun, clockLabel, elapsedSec, finishRun, isRunning, remainingSec, startRun, type PressureTest,
} from "@/lib/study/pressureTest";
import { PressureChart } from "./PressureChart";

const PRESETS = [15, 30, 60];
const fmtBar = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n).replace(".", ","));
/** Ciśnienie w polu: „6”, „5,9”; pusty albo zły tekst → `undefined`. */
const readBar = (raw: string): number | undefined => { const v = parseAmount(raw); return typeof v === "number" ? v : undefined; };

/**
 * B3.1 Minutnik próby szczelności. Stan próby (`startedAt`, odczyty) jest w protokole, a nie w komponencie, więc
 * zamknięcie okna czy przeładowanie niczego nie gubi, a licznik po powrocie liczy się od zapisanego startu.
 * Ekran zostaje włączony, dopóki próba trwa; na koniec czasu alert wystawia `PressureRunWatcher`.
 */
export function PressureTestTimer({ open, onOpenChange, test, onUpdate }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  test: PressureTest;
  onUpdate: (test: PressureTest) => void;
}) {
  const running = isRunning(test);
  const [now, setNow] = useState(() => Date.now());
  const [startBar, setStartBar] = useState(fmtBar(test.bar));
  const [minutes, setMinutes] = useState(fmtBar(test.minutes ?? 30));
  const [reading, setReading] = useState("");
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState("");

  useWakeLock(open && running);

  useEffect(() => {
    if (!open || !running) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    const onVisible = () => setNow(Date.now());
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
  }, [open, running]);

  // Otwarcie okna: pola z aktualnego protokołu, bez rozpoczętego kończenia.
  useEffect(() => {
    if (!open) return;
    setStartBar(fmtBar(test.bar)); setMinutes(fmtBar(test.minutes ?? 30)); setReading(""); setFinishing(false); setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tylko przy otwarciu; pola nie mogą się nadpisywać w trakcie pisania
  }, [open]);

  const last = test.readings?.at(-1)?.bar;
  const left = remainingSec(test, now);
  const elapsed = elapsedSec(test, now);
  const total = Math.round((test.minutes ?? 0) * 60);
  const over = running && total > 0 && elapsed >= total;

  function start() {
    const bar = readBar(startBar);
    const min = readBar(minutes);
    if (bar === undefined || bar <= 0) { setError("Wpisz ciśnienie początkowe, np. 6"); return; }
    if (min === undefined || min <= 0) { setError("Wpisz czas próby w minutach, np. 30"); return; }
    setError("");
    requestNotificationPermissionOnIntent(); // wprost z kliknięcia: tylko wtedy przeglądarka pyta o zgodę
    onUpdate(startRun(test, bar, min, Date.now()));
    setNow(Date.now());
    haptic("success");
  }

  function addPoint() {
    const bar = readBar(reading);
    if (bar === undefined) { setError("Wpisz odczyt z manometru, np. 5,9"); return; }
    setError("");
    onUpdate(addReading(test, bar, Date.now()));
    setReading("");
    haptic("selection");
  }

  function finish(early = false) {
    const bar = readBar(reading !== "" ? reading : fmtBar(last));
    if (bar === undefined) { setError("Wpisz ciśnienie końcowe z manometru"); return; }
    setError("");
    // Audyt UI #30: wynik „szczelna” zależy tylko od spadku, więc koniec przed czasem pytamy, zamiast wpisywać po cichu.
    if (!early && test.minutes !== null && left > 0) {
      toast("Próba jeszcze trwa", {
        description: `Minęło ${clockLabel(elapsed)} z ${clockLabel(Math.round(test.minutes * 60))}. Zakończyć wcześniej?`,
        action: { label: "Zakończ mimo to", onClick: () => finish(true) },
        duration: 10_000,
      });
      return;
    }
    onUpdate(finishRun(test, bar, Date.now()));
    setFinishing(false);
    setReading("");
    haptic("success");
    onOpenChange(false);
  }

  const fieldCls = "w-full rounded-field border border-input bg-background px-3 py-2 text-base font-mono tabular-nums text-foreground outline-hidden focus:ring-2 focus:ring-ring disabled:text-muted-foreground coarse:h-11";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="gap-0 p-0 sm:max-w-sm" data-testid="pressure-test-timer">
        <div className="border-b border-border px-5 pb-4 pt-5">
          <DialogTitle className="flex items-center gap-2 font-display text-lg">
            <Clock className="h-5 w-5 shrink-0 text-primary-ink" aria-hidden />
            Próba szczelności
          </DialogTitle>
          <DialogDescription className="text-xs">
            {running ? "Próba trwa. Możesz zamknąć okno i wrócić — licznik liczy się od startu." : "Ustaw ciśnienie i czas, potem Start. Ekran nie zgaśnie, a na koniec czasu dostaniesz powiadomienie."}
          </DialogDescription>
        </div>

        <div className="space-y-4 px-5 py-4">
          {!running ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1 text-xs font-medium text-muted-foreground">
                  Ciśnienie początkowe [bar]
                  <input value={startBar} onChange={(e) => setStartBar(e.target.value)} inputMode="decimal" data-testid="timer-start-bar" className={fieldCls} />
                </label>
                <label className="block space-y-1 text-xs font-medium text-muted-foreground">
                  Czas próby [min]
                  <input value={minutes} onChange={(e) => setMinutes(e.target.value)} inputMode="decimal" data-testid="timer-minutes" className={fieldCls} />
                </label>
              </div>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Typowy czas próby">
                {PRESETS.map((m) => (
                  <button key={m} type="button" onClick={() => setMinutes(String(m))} aria-pressed={readBar(minutes) === m}
                    className="pressable rounded-full border border-border px-3 py-1 text-sm text-muted-foreground hover:text-foreground aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-foreground coarse:min-h-11">
                    {m} min
                  </button>
                ))}
              </div>
              {test.readings && test.readings.length > 1 && <PressureChart test={test} />}
              <Button type="button" size="lg" onClick={start} className="w-full coarse:h-12" data-testid="timer-start">
                <Play className="mr-2 h-4 w-4" aria-hidden />Start próby
              </Button>
            </>
          ) : (
            <>
              <div className="rounded-card border border-border bg-muted p-4 text-center" role="timer" aria-live="off" data-testid="timer-display">
                <div className={over ? "font-mono text-4xl font-bold tabular-nums text-success-ink" : "font-mono text-4xl font-bold tabular-nums text-foreground"} data-testid="timer-clock">
                  {over ? "Czas minął" : clockLabel(left)}
                </div>
                <p className="ui-hint mt-1" data-testid="timer-sub">
                  {over ? `Minęło ${clockLabel(elapsed)} — wpisz ciśnienie końcowe.` : `Do końca · upłynęło ${clockLabel(elapsed)} z ${clockLabel(total)}`}
                </p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border" aria-hidden>
                  <div className="h-full bg-primary transition-[width] duration-1000 ease-linear motion-reduce:transition-none" style={{ width: `${total > 0 ? Math.min(100, (elapsed / total) * 100) : 0}%` }} />
                </div>
              </div>

              <PressureChart test={test} />

              <div className="space-y-2">
                <label className="block text-xs font-medium text-muted-foreground" htmlFor="timer-reading">
                  {finishing ? "Ciśnienie końcowe [bar]" : "Odczyt z manometru [bar]"}
                </label>
                <div className="flex gap-2">
                  <input id="timer-reading" value={reading} onChange={(e) => setReading(e.target.value)} inputMode="decimal" data-testid="timer-reading"
                    placeholder={fmtBar(last)} className={fieldCls} />
                  {!finishing && <Button type="button" variant="outline" onClick={addPoint} className="shrink-0 coarse:h-11" data-testid="timer-add-reading">Dodaj odczyt</Button>}
                </div>
              </div>
            </>
          )}
          <p className="min-h-5 text-sm text-destructive-ink" role="alert" data-testid="timer-error">{error}</p>
        </div>

        <ResponsiveDialogFooter className="grid grid-cols-2 gap-2 border-t border-border px-5 pb-5 pt-4">
          {running ? (
            <>
              <Button type="button" variant="ghost" onClick={() => { onUpdate(cancelRun(test)); setError(""); haptic("tap"); }} className="coarse:h-11" data-testid="timer-cancel">
                <X className="mr-1 h-4 w-4" aria-hidden />Przerwij próbę
              </Button>
              <Button type="button" onClick={() => (finishing ? finish() : setFinishing(true))} className="coarse:h-11" data-testid="timer-finish">
                <Square className="mr-1 h-4 w-4" aria-hidden />{finishing ? "Zapisz wynik" : "Zakończ próbę"}
              </Button>
            </>
          ) : (
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="col-span-2 coarse:h-11">Zamknij</Button>
          )}
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </Dialog>
  );
}
