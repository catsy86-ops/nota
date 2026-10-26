import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { barcodeDetectorCtor, codeFromScan, decodeQrImage } from "@/lib/qrScan";

interface QrScanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Odczytany kod grupy (12 znaków). Okno zamyka się samo po trafieniu. */
  onCode: (code: string) => void;
}

/**
 * „Zeskanuj kod” przy dołączaniu do grupy (U-2). Na Androidzie z `BarcodeDetector` — podgląd kamery,
 * wszędzie — wybór zdjęcia kodu (jsQR, ładowany dopiero teraz).
 */
export function QrScanDialog({ open, onOpenChange, onCode }: QrScanDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState("");
  const fileId = useId();
  const live = barcodeDetectorCtor() !== null;

  useEffect(() => {
    if (!open || !live) return;
    const Detector = barcodeDetectorCtor();
    if (!Detector) return;
    const detector = new Detector({ formats: ["qr_code"] });
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const loop = async () => {
      const video = videoRef.current;
      if (stopped || !video) return;
      try {
        const hits = await detector.detect(video);
        const code = hits[0] ? codeFromScan(hits[0].rawValue) : null;
        if (code) { onCode(code); onOpenChange(false); return; }
      } catch {
        // Klatka bez kodu albo wideo jeszcze się nie zaczęło — spróbujemy za chwilę.
      }
      timer = setTimeout(loop, 250);
    };

    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(async (s) => {
      stream = s;
      if (stopped || !videoRef.current) { s.getTracks().forEach((t) => t.stop()); return; }
      videoRef.current.srcObject = s;
      await videoRef.current.play().catch(() => undefined);
      void loop();
    }).catch(() => setStatus("Nie udało się włączyć kamery — wybierz zdjęcie kodu."));

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open, live, onCode, onOpenChange]);

  async function pickFile(file: File | undefined) {
    if (!file) return;
    setStatus("Szukam kodu na zdjęciu…");
    try {
      const raw = await decodeQrImage(file);
      const code = raw ? codeFromScan(raw) : null;
      if (code) { onCode(code); onOpenChange(false); return; }
      setStatus("Nie znalazłem kodu na tym zdjęciu. Spróbuj wyraźniejszego.");
    } catch {
      setStatus("Nie udało się odczytać zdjęcia.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Zeskanuj kod</DialogTitle>
          <DialogDescription>Skieruj aparat na kod z drugiego urządzenia albo wybierz jego zdjęcie.</DialogDescription>
        </DialogHeader>
        {live && <video ref={videoRef} muted playsInline aria-label="Podgląd kamery" className="w-full rounded-control bg-black aspect-square object-cover" />}
        <div className="flex flex-col gap-2">
          <label htmlFor={fileId} className="inline-flex cursor-pointer items-center justify-center rounded-control border border-input px-4 py-2 text-sm font-medium hover:bg-muted coarse:min-h-11">
            Wybierz zdjęcie kodu
          </label>
          <input id={fileId} type="file" accept="image/*" className="sr-only" onChange={(e) => { void pickFile(e.target.files?.[0]); e.target.value = ""; }} />
          <p role="status" className="min-h-5 text-xs text-muted-foreground">{status}</p>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="coarse:h-11">Zamknij</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
