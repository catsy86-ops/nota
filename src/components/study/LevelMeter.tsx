import { useEffect, useRef, useState } from "react";
import { AlertCircle, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveDialogContent, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { createPersistedStore } from "@/lib/persistedStore";
import { slopeLabel, slopePercent, slopeZone, smooth, SLOPE_OK_MAX, SLOPE_OK_MIN } from "@/lib/study/slope";
import { toast } from "sonner";

type Axis = "beta" | "gamma";
type Status = "idle" | "waiting" | "live" | "denied" | "nosensor";

/** Kalibracja: odczyt na płaskiej powierzchni, odejmowany od pomiaru (osobno dla obu osi). Na urządzeniu. */
const offsetStore = createPersistedStore<Record<Axis, number>>("kaczy.level.offset.v1", { beta: 0, gamma: 0 }, {
  merge: (d, s) => {
    const o = (s ?? {}) as Partial<Record<Axis, unknown>>;
    const n = (v: unknown, def: number) => (typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 90 ? v : def);
    return { beta: n(o.beta, d.beta), gamma: n(o.gamma, d.gamma) };
  },
});

/** Czas bez żadnego zdarzenia, po którym uznajemy, że urządzenie nie ma czujnika. */
const NO_SENSOR_MS = 2500;

interface LevelMeterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Zwraca zmierzony kąt w stopniach (po kalibracji); spadek w % liczy `slopePercent`. */
  onSelect: (angle: number) => void;
}

/**
 * B3.4 Poziomica i spadek: telefon przyłożony do rury pokazuje spadek w % (tan kąta), na zielono w zakresie 2–3%.
 * Oś „wzdłuż” to przechył góra–dół telefonu, „w poprzek” — na boki. Przed pomiarem warto skalibrować telefon na płaskiej
 * powierzchni. To sprawdzenie, nie pomiar (dokładność czujnika to ok. 0,1–0,2°).
 */
export function LevelMeter({ open, onOpenChange, onSelect }: LevelMeterProps) {
  const [axis, setAxis] = useState<Axis>("beta");
  const [raw, setRaw] = useState<Record<Axis, number> | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const offset = offsetStore.use();
  const filtered = useRef<Record<Axis, number | null>>({ beta: null, gamma: null });

  function listen() {
    setStatus("waiting");
    filtered.current = { beta: null, gamma: null };
    const onEvent = (e: DeviceOrientationEvent) => {
      if (e.beta === null && e.gamma === null) return;
      filtered.current = { beta: smooth(filtered.current.beta, e.beta ?? 0), gamma: smooth(filtered.current.gamma, e.gamma ?? 0) };
      setRaw({ beta: filtered.current.beta!, gamma: filtered.current.gamma! });
      setStatus("live");
    };
    window.addEventListener("deviceorientation", onEvent);
    const timer = window.setTimeout(() => setStatus((s) => (s === "waiting" ? "nosensor" : s)), NO_SENSOR_MS);
    return () => { window.removeEventListener("deviceorientation", onEvent); window.clearTimeout(timer); };
  }

  useEffect(() => {
    if (!open) return;
    setRaw(null);
    if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) { setStatus("nosensor"); return; }
    // iOS 13+ pyta o zgodę tylko z kliknięcia — wtedy czekamy na przycisk „Włącz czujnik”.
    const needsPermission = typeof (DeviceOrientationEvent as unknown as { requestPermission?: unknown }).requestPermission === "function";
    if (needsPermission) {
      setStatus("idle");
      // Nasłuch uruchomiony po kliknięciu „Włącz czujnik” trzeba zwolnić przy zamknięciu okna (komponent stoi zamontowany).
      return () => { stopRef.current?.(); stopRef.current = null; };
    }
    return listen();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `listen` zależy tylko od stanu lokalnego
  }, [open]);

  const stopRef = useRef<(() => void) | null>(null);
  useEffect(() => () => stopRef.current?.(), []);

  async function enable() {
    try {
      const result = await (DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission();
      if (result !== "granted") { setStatus("denied"); return; }
      stopRef.current?.();
      stopRef.current = listen();
    } catch {
      setStatus("denied");
    }
  }

  const angle = raw ? Math.round((raw[axis] - offset[axis]) * 10) / 10 : 0;
  const percent = slopePercent(angle);
  const zone = slopeZone(percent);

  function calibrate() {
    if (!raw) return;
    offsetStore.set({ ...offset, [axis]: Math.round(raw[axis] * 100) / 100 });
    haptic("success");
    toast.success("Skalibrowano — ten odczyt to teraz zero");
  }

  function save() {
    onSelect(angle);
    onOpenChange(false);
    toast.success(`Spadek: ${slopeLabel(angle)}`);
  }

  const live = status === "live";
  const blocked = status === "denied" || status === "nosensor";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="gap-0 p-0 sm:max-w-sm" data-testid="level-meter">
        <div className="border-b border-border px-5 pb-4 pt-5">
          <DialogTitle className="flex items-center gap-2 font-display text-lg">
            <Maximize2 className="h-5 w-5 shrink-0 text-primary-ink" aria-hidden />
            Spadek rury
          </DialogTitle>
          <DialogDescription className="text-xs">Przyłóż telefon długim bokiem wzdłuż rury, ekranem do góry.</DialogDescription>
        </div>

        <div className="space-y-3 px-5 py-4">
          {blocked ? (
            <div className="flex gap-3 rounded-card border border-warning bg-warning/5 p-3" role="status" data-testid="level-blocked">
              <AlertCircle className="h-5 w-5 shrink-0 text-warning-ink" aria-hidden />
              <p className="text-sm">{status === "denied" ? "Brak zgody na czujnik ruchu. Zezwól na nią w ustawieniach przeglądarki." : "Ten telefon nie przesyła danych z czujnika orientacji (albo to komputer)."}</p>
            </div>
          ) : status === "idle" ? (
            <Button type="button" onClick={() => void enable()} className="w-full coarse:h-12" data-testid="level-enable">Włącz czujnik</Button>
          ) : (
            <>
              <div className="rounded-card border border-border bg-muted p-5 text-center" role="status" aria-live="off">
                <div className={cn("font-mono text-5xl font-bold tabular-nums", live && zone === "ok" ? "text-success-ink" : "text-warning-ink")} data-testid="level-percent">
                  {live ? `${String(Math.abs(percent)).replace(".", ",")}%` : "…"}
                </div>
                <p className="ui-hint mt-1" data-testid="level-angle">
                  {live ? `${String(Math.abs(angle)).replace(".", ",")}° · ${zone === "ok" ? "w normie" : `poza zakresem ${SLOPE_OK_MIN}–${SLOPE_OK_MAX}%`}` : "Czekam na odczyt z czujnika…"}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2" role="group" aria-label="Oś pomiaru">
                {(["beta", "gamma"] as const).map((a) => (
                  <button key={a} type="button" aria-pressed={axis === a} onClick={() => setAxis(a)}
                    className="pressable flex-1 rounded-full border border-border px-3 py-1 text-sm text-muted-foreground aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-foreground coarse:min-h-11">
                    {a === "beta" ? "Wzdłuż telefonu" : "W poprzek telefonu"}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={calibrate} disabled={!live} className="flex-1 coarse:h-11" data-testid="level-calibrate">Kalibruj na płasko</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => offsetStore.set({ ...offset, [axis]: 0 })} disabled={offset[axis] === 0} className="coarse:h-11">Zeruj</Button>
              </div>
              <p className="ui-hint">Kalibracja: połóż telefon na płaskiej powierzchni i stuknij „Kalibruj na płasko”. To sprawdzenie, nie pomiar — czujnik myli się o ok. 0,1–0,2°. Znak zależy od ułożenia telefonu, więc pokazujemy sam spadek.</p>
            </>
          )}
        </div>

        <ResponsiveDialogFooter className="grid grid-cols-2 gap-2 border-t border-border px-5 pb-5 pt-4">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="coarse:h-11">Anuluj</Button>
          <Button type="button" onClick={save} disabled={!live} className="coarse:h-11" data-testid="level-save">Zapisz</Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </Dialog>
  );
}
