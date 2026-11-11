import { useEffect, useRef, useState } from "react";
import { AlertCircle, Camera, FlipHorizontal2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveDialogContent, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";
import { captureFrame, hasTorch, openCamera, setTorch, stopStream, type CameraError } from "@/lib/cameraCapture";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface CameraPointOption {
  id: string;
  label: string;
}

type State = "starting" | "live" | CameraError;

const PROBLEM: Record<CameraError, string> = {
  denied: "Brak dostępu do kamery. Zezwól na nią w ustawieniach przeglądarki albo użyj „Dodaj zdjęcie” (aparat systemowy).",
  notfound: "Nie znaleziono kamery. Użyj „Dodaj zdjęcie” (aparat systemowy).",
  unsupported: "Ta przeglądarka nie daje dostępu do kamery. Użyj „Dodaj zdjęcie” (aparat systemowy).",
  error: "Nie udało się uruchomić kamery. Użyj „Dodaj zdjęcie” (aparat systemowy).",
};

/**
 * B3.9 Aparat w aplikacji: podgląd, seria zdjęć bez wychodzenia z okna, latarka (tylko gdy kamera ją udostępnia — szacht,
 * kotłownia, miejsce pod wanną) i wybór punktu przed zdjęciem. Okno zostaje otwarte po każdym zdjęciu aż do „Gotowe”
 * albo do limitu zdjęć wpisu. Kamera i latarka gasną przy zamknięciu.
 */
export function CameraCapture({ open, onOpenChange, onCapture, count, max, points = [], point, onPoint }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Zdjęcie ze zrzutu klatki; rodzic przygotowuje je i dodaje do wpisu. */
  onCapture: (blob: Blob) => void | number | Promise<void | number>;
  /** Zdjęcia, które wpis już ma (z galerią i trwającą obróbką), i limit wpisu. */
  count: number;
  max: number;
  /** Punkty tej budowy do wyboru przed zdjęciem; puste = bez wyboru. */
  points?: readonly CameraPointOption[];
  point?: string;
  onPoint?: (id: string | undefined) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<State>("starting");
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [torchOk, setTorchOk] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [shots, setShots] = useState(0);
  const [flash, setFlash] = useState(false);
  const [busy, setBusy] = useState(false);
  const full = count >= max;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setState("starting"); setTorchOk(false); setTorchOn(false);
    void (async () => {
      const r = await openCamera(facing);
      if (cancelled) { if ("stream" in r) stopStream(r.stream); return; }
      if ("error" in r) { setState(r.error); return; }
      streamRef.current = r.stream;
      setTorchOk(hasTorch(r.stream));
      const video = videoRef.current;
      if (video) { video.srcObject = r.stream; await video.play().catch(() => undefined); }
      if (!cancelled) setState("live");
    })();
    return () => {
      cancelled = true;
      if (streamRef.current) { stopStream(streamRef.current); streamRef.current = null; }
    };
  }, [open, facing]);

  // Nowe otwarcie zaczyna serię od zera.
  useEffect(() => { if (open) setShots(0); }, [open]);

  async function toggleTorch() {
    const stream = streamRef.current;
    if (!stream) return;
    const next = !torchOn;
    if (await setTorch(stream, next)) setTorchOn(next);
    else { setTorchOn(false); toast.error("Ten telefon nie włączył latarki w aparacie"); }
  }

  async function snap() {
    const video = videoRef.current;
    if (!video || state !== "live" || full || busy) return;
    setBusy(true);
    try {
      const blob = await captureFrame(video);
      if (!blob) { toast.error("Kamera jeszcze nie dała obrazu — spróbuj za chwilę"); return; }
      haptic("tap");
      setFlash(true);
      window.setTimeout(() => setFlash(false), 120);
      // Rodzic zwraca liczbę zdjęć, które trafiły do wpisu (odrzucone nie zawyżają licznika serii).
      const added = await onCapture(blob);
      setShots((n) => n + (typeof added === "number" ? added : 1));
    } catch {
      toast.error("Nie udało się zapisać zdjęcia z aparatu");
    } finally {
      setBusy(false);
    }
  }

  const problem = state !== "starting" && state !== "live" ? state : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="gap-0 p-0 sm:max-w-sm" data-testid="camera-capture">
        <div className="border-b border-border px-5 pb-4 pt-5">
          <DialogTitle className="flex items-center gap-2 font-display text-lg">
            <Camera className="h-5 w-5 shrink-0 text-primary-ink" aria-hidden />
            Aparat
          </DialogTitle>
          <DialogDescription className="text-xs">Rób zdjęcia jedno po drugim, okno zostaje otwarte. Latarka, gdy telefon ją daje.</DialogDescription>
        </div>

        <div className="space-y-3 px-5 py-4">
          {problem ? (
            <div className="flex gap-3 rounded-card border border-warning bg-warning/5 p-3" role="status" data-testid="camera-problem">
              <AlertCircle className="h-5 w-5 shrink-0 text-warning-ink" aria-hidden />
              <p className="text-sm">{PROBLEM[problem]}</p>
            </div>
          ) : (
            <>
              <div className="relative">
                <video ref={videoRef} className="aspect-[4/3] w-full rounded-card border border-border bg-black object-cover" playsInline muted aria-label="Podgląd z kamery" />
                {flash && <div className="pointer-events-none absolute inset-0 rounded-card bg-white/70" aria-hidden />}
              </div>
              <div className="flex gap-2">
                {torchOk && (
                  <Button type="button" variant="outline" size="sm" onClick={() => void toggleTorch()} aria-pressed={torchOn} data-testid="camera-torch"
                    className={cn("flex-1 coarse:h-11", torchOn && "border-primary bg-primary/10")}>
                    <Zap className="h-4 w-4" aria-hidden />Latarka
                  </Button>
                )}
                <Button type="button" variant="outline" size="sm" onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))} className="flex-1 coarse:h-11" data-testid="camera-flip">
                  <FlipHorizontal2 className="h-4 w-4" aria-hidden />Zmień kamerę
                </Button>
              </div>
              {points.length > 0 && onPoint && (
                <label className="block space-y-1 text-xs text-muted-foreground">
                  Zdjęcia dotyczą punktu
                  <select value={point ?? ""} onChange={(e) => onPoint(e.target.value || undefined)} data-testid="camera-point"
                    className="h-10 w-full rounded-field border border-input bg-background px-2 text-base text-foreground outline-hidden focus:ring-2 focus:ring-ring coarse:h-11 sm:text-sm">
                    <option value="">Bez punktu</option>
                    {points.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </label>
              )}
              <p className="ui-hint" role="status" data-testid="camera-count">
                {full ? `Wpis ma komplet zdjęć (${max}).` : `Zdjęcia we wpisie: ${count} z ${max}${shots > 0 ? ` · z aparatu: ${shots}` : ""}`}
              </p>
            </>
          )}
        </div>

        <ResponsiveDialogFooter className="grid grid-cols-2 gap-2 border-t border-border px-5 pb-5 pt-4">
          <Button type="button" variant={shots > 0 ? "outline" : "ghost"} onClick={() => onOpenChange(false)} className="coarse:h-11" data-testid="camera-done">
            {shots > 0 ? "Gotowe" : "Zamknij"}
          </Button>
          <Button type="button" onClick={() => void snap()} disabled={state !== "live" || full || busy} className="coarse:h-11" data-testid="camera-shutter">
            Zrób zdjęcie
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </Dialog>
  );
}
