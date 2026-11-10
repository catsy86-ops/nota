import { useEffect, useRef, useState } from "react";
import { AlertCircle, Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveDialogContent, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";
import { hasBarcodeDetector, requestCamera, scanBarcode } from "@/lib/barcode";
import { toast } from "sonner";

interface BarcodeScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (code: string) => void;
}

export function BarcodeScanner({ open, onOpenChange, onDetected }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [supported, setSupported] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState("");

  useEffect(() => {
    if (!open) {
      setScanning(false);
      setCode("");
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      return;
    }

    if (!hasBarcodeDetector()) {
      setSupported(false);
      return;
    }

    const startScanning = async () => {
      const stream = await requestCamera();
      if (!stream) {
        toast.error("Nie udzielono dostępu do kamery");
        setSupported(false);
        return;
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setScanning(true);

      const scanLoop = async () => {
        if (!videoRef.current || !scanning) return;
        const detected = await scanBarcode(videoRef.current);
        if (detected) {
          setCode(detected);
          setScanning(false);
          return;
        }
        requestAnimationFrame(scanLoop);
      };

      scanLoop();
    };

    void startScanning();
  }, [open, scanning]);

  function use() {
    if (!code) return;
    onDetected(code);
    onOpenChange(false);
    toast.success(`Skanowany kod: ${code}`);
  }

  function manual() {
    const input = prompt("Wpisz kod ręcznie:");
    if (input) {
      setCode(input);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="gap-0 p-0 sm:max-w-sm" data-testid="barcode-scanner">
        <div className="border-b border-border px-5 pb-4 pt-5">
          <DialogTitle className="flex items-center gap-2 font-display text-lg">
            <Camera className="h-5 w-5 shrink-0 text-primary-ink" aria-hidden />
            Skaner kodów
          </DialogTitle>
          <DialogDescription className="text-xs">QR, EAN, Code128, Code39 (B3.5)</DialogDescription>
        </div>

        <div className="space-y-3 px-5 py-4">
          {!supported ? (
            <div className="flex gap-3 rounded-card border border-warning bg-warning/5 p-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-warning-ink" aria-hidden />
              <div className="text-sm">BarcodeDetector niedostępny. Wpisz kod ręcznie.</div>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="w-full rounded-card border border-border bg-black aspect-video object-cover"
                playsInline
                muted
              />
              <p className="text-2xs text-muted-foreground">
                Przytrzymaj kod przed kamerą. Kamera wyłączy się po wykryciu.
              </p>
            </>
          )}

          {code && (
            <div className="rounded-card border border-success bg-success/5 p-3">
              <p className="text-2xs text-muted-foreground">Skanowany kod:</p>
              <p className="font-mono text-sm text-foreground break-all">{code}</p>
            </div>
          )}

          <Button type="button" variant="outline" size="sm" onClick={manual} className="w-full coarse:h-10">
            Wpisz ręcznie
          </Button>
        </div>

        <ResponsiveDialogFooter className="grid grid-cols-2 gap-2 border-t border-border px-5 pb-5 pt-4">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="coarse:h-11">
            <X className="mr-1 h-4 w-4" aria-hidden />
            Zamknij
          </Button>
          <Button type="button" onClick={use} disabled={!code} className="coarse:h-11">
            Użyj
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </Dialog>
  );
}
