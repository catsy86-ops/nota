import { useEffect, useRef, useState } from "react";
import { Camera, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveDialogContent, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";
import { hasCamera, requestCamera, captureFrame, stopStream } from "@/lib/cameraCapture";
import { toast } from "sonner";

interface CameraCaptureProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Zwraca blob zdjęcia. */
  onCapture: (blob: Blob) => void;
}

export function CameraCapture({ open, onOpenChange, onCapture }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [supported, setSupported] = useState(true);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    if (!open) {
      setPreview(false);
      if (streamRef.current) {
        stopStream(streamRef.current);
        streamRef.current = null;
      }
      return;
    }

    if (!hasCamera()) {
      setSupported(false);
      return;
    }

    const startCamera = async () => {
      const stream = await requestCamera(facingMode);
      if (!stream) {
        toast.error("Nie udzielono dostępu do kamery");
        setSupported(false);
        return;
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setPreview(true);
      }
    };

    void startCamera();
  }, [open, facingMode]);

  async function snap() {
    if (!videoRef.current || !preview) return;

    const blob = await captureFrame(videoRef.current);
    if (!blob) {
      toast.error("Nie udało się zrobić zdjęcia");
      return;
    }

    onCapture(blob);
    onOpenChange(false);
    toast.success("Zdjęcie dodane");
  }

  function switchCamera() {
    if (streamRef.current) {
      stopStream(streamRef.current);
      streamRef.current = null;
      setPreview(false);
    }
    setFacingMode((m) => (m === "environment" ? "user" : "environment"));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="gap-0 p-0 sm:max-w-sm" data-testid="camera-capture">
        <div className="border-b border-border px-5 pb-4 pt-5">
          <DialogTitle className="flex items-center gap-2 font-display text-lg">
            <Camera className="h-5 w-5 shrink-0 text-primary-ink" aria-hidden />
            Aparat
          </DialogTitle>
          <DialogDescription className="text-xs">Live preview kamery (B3.9)</DialogDescription>
        </div>

        <div className="space-y-3 px-5 py-4">
          {!supported ? (
            <div className="flex gap-3 rounded-card border border-warning bg-warning/5 p-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-warning-ink" aria-hidden />
              <div className="text-sm">Kamera niedostępna. Użyj innego urządzenia.</div>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="w-full rounded-card border border-border bg-black aspect-video object-cover"
                playsInline
                muted
              />
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={switchCamera} className="flex-1 coarse:h-10">
                  Zmień kamerę
                </Button>
              </div>
            </>
          )}
        </div>

        <ResponsiveDialogFooter className="grid grid-cols-2 gap-2 border-t border-border px-5 pb-5 pt-4">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="coarse:h-11">
            <X className="mr-1 h-4 w-4" aria-hidden />
            Zamknij
          </Button>
          <Button type="button" onClick={snap} disabled={!preview || !supported} className="coarse:h-11">
            Zrób zdjęcie
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </Dialog>
  );
}
