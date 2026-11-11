import { useEffect, useRef, useState } from "react";
import { AlertCircle, Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveDialogContent, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";
import { cleanCode, CODE_MAX, hasBarcodeDetector, requestCamera, scanBarcode } from "@/lib/barcode";
import { haptic } from "@/lib/haptics";
import { toast } from "sonner";

type CameraState = "starting" | "scanning" | "unsupported" | "denied";

/** Co 250 ms wystarczy: ręka z opakowaniem i tak się rusza wolniej, a detektor nie dostaje każdej klatki. */
const SCAN_EVERY_MS = 250;

/**
 * B3.5 Skaner kodów: podgląd kamery z tyłu i natywny `BarcodeDetector`. Bez kamery, bez zgody albo bez
 * detektora zostaje wpis ręczny w tym samym oknie. `autoUse`: po wykryciu kod od razu trafia do `onDetected`
 * i okno się zamyka (przyjęcie towaru); bez niego kod czeka na „Użyj” (np. numer seryjny we wpisie).
 */
export function BarcodeScanner({ open, onOpenChange, onDetected, autoUse = false, title = "Skaner kodów", hint }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (code: string) => void;
  autoUse?: boolean;
  title?: string;
  hint?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState<CameraState>("starting");
  const [code, setCode] = useState("");
  const [manual, setManual] = useState("");
  // Najnowsze wywołania bez restartu kamery przy każdej zmianie rodzica.
  const live = useRef({ onDetected, onOpenChange, autoUse });
  live.current = { onDetected, onOpenChange, autoUse };

  function accept(raw: string) {
    const clean = cleanCode(raw);
    if (!clean) return false;
    haptic("success");
    if (live.current.autoUse) { live.current.onDetected(clean); live.current.onOpenChange(false); }
    else setCode(clean);
    return true;
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let frame = 0;
    setCode(""); setManual(""); setCamera("starting");

    const stop = () => { cancelAnimationFrame(frame); stream?.getTracks().forEach((t) => t.stop()); stream = null; };

    void (async () => {
      if (!hasBarcodeDetector()) { setCamera("unsupported"); return; }
      const s = await requestCamera();
      if (cancelled) { s?.getTracks().forEach((t) => t.stop()); return; }
      if (!s) { setCamera("denied"); return; }
      stream = s;
      const video = videoRef.current;
      if (!video) { stop(); return; }
      video.srcObject = s;
      await video.play().catch(() => undefined);
      if (cancelled) return;
      setCamera("scanning");
      let last = 0;
      const tick = async (t: number) => {
        if (cancelled) return;
        if (t - last >= SCAN_EVERY_MS) {
          last = t;
          const found = await scanBarcode(video);
          if (cancelled) return;
          if (found && accept(found)) { stop(); return; }
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    })();

    return () => { cancelled = true; stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tylko otwarcie/zamknięcie; reszta idzie przez `live`
  }, [open]);

  function use() {
    if (!code) return;
    live.current.onDetected(code);
    live.current.onOpenChange(false);
    toast.success(`Kod: ${code}`);
  }

  function submitManual() {
    if (!accept(manual)) return;
    setManual("");
  }

  const noCamera = camera === "unsupported" || camera === "denied";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="gap-0 p-0 sm:max-w-sm" data-testid="barcode-scanner">
        <div className="border-b border-border px-5 pb-4 pt-5">
          <DialogTitle className="flex items-center gap-2 font-display text-lg">
            <Camera className="h-5 w-5 shrink-0 text-primary-ink" aria-hidden />
            {title}
          </DialogTitle>
          <DialogDescription className="text-xs">{hint ?? "EAN z opakowania, QR albo kod kreskowy."}</DialogDescription>
        </div>

        <div className="space-y-3 px-5 py-4">
          {noCamera ? (
            <div className="flex gap-3 rounded-card border border-warning bg-warning/5 p-3" role="status" data-testid="scanner-fallback">
              <AlertCircle className="h-5 w-5 shrink-0 text-warning-ink" aria-hidden />
              <p className="text-sm">
                {camera === "denied" ? "Brak dostępu do kamery. Zezwól na nią w ustawieniach przeglądarki albo wpisz kod poniżej." : "Ta przeglądarka nie ma skanera kodów. Wpisz kod z opakowania poniżej."}
              </p>
            </div>
          ) : (
            <>
              <video ref={videoRef} className="aspect-video w-full rounded-card border border-border bg-black object-cover" playsInline muted aria-label="Podgląd z kamery" />
              <p className="ui-hint" role="status" data-testid="scanner-status">
                {camera === "starting" ? "Uruchamiam kamerę…" : "Przytrzymaj kod przed kamerą. Wykryję go sam."}
              </p>
            </>
          )}

          {code && (
            <div className="rounded-card border border-success bg-success/5 p-3" data-testid="scanner-code">
              <p className="ui-hint">Kod:</p>
              <p className="break-all font-mono text-sm text-foreground">{code}</p>
            </div>
          )}

          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); submitManual(); }} aria-label="Kod ręcznie">
            <input value={manual} onChange={(e) => setManual(e.target.value)} maxLength={CODE_MAX} aria-label="Wpisz kod ręcznie" placeholder="Kod z opakowania"
              inputMode="text" autoComplete="off" data-testid="scanner-manual"
              className="min-w-0 flex-1 rounded-field border border-input bg-background px-3 py-2 font-mono text-base text-foreground outline-hidden focus:ring-2 focus:ring-ring coarse:h-11 sm:text-sm" />
            <Button type="submit" variant="outline" disabled={!cleanCode(manual)} className="shrink-0 coarse:h-11">{autoUse ? "Użyj" : "Wpisz"}</Button>
          </form>
        </div>

        <ResponsiveDialogFooter className="grid grid-cols-2 gap-2 border-t border-border px-5 pb-5 pt-4">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className={autoUse ? "col-span-2 coarse:h-11" : "coarse:h-11"}>
            <X className="mr-1 h-4 w-4" aria-hidden />
            Zamknij
          </Button>
          {!autoUse && (
            <Button type="button" onClick={use} disabled={!code} className="coarse:h-11">Użyj</Button>
          )}
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </Dialog>
  );
}
