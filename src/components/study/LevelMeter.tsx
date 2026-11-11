import { useEffect, useRef, useState } from "react";
import { AlertCircle, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveDialogContent, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface LevelMeterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Zwraca zmierzony kąt w stopniach. */
  onSelect: (angle: number) => void;
}

export function LevelMeter({ open, onOpenChange, onSelect }: LevelMeterProps) {
  const [angle, setAngle] = useState(0);
  const [supported, setSupported] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const listenerRef = useRef<((e: DeviceOrientationEvent) => void) | null>(null);

  useEffect(() => {
    if (!open) return;

    // Sprawdzenie wsparcia DeviceOrientationEvent
    if (!window.DeviceOrientationEvent) {
      setSupported(false);
      return;
    }

    // Obsługiwacz orientacji urządzenia — beta to oś X (przechył na przód/tył)
    const handleOrientation = (e: DeviceOrientationEvent) => {
      const beta = e.beta ?? 0; // -180 do 180, gdzie 0 = poziomo
      setAngle(Math.round(beta * 100) / 100);
    };

    listenerRef.current = handleOrientation;
    window.addEventListener("deviceorientation", handleOrientation);

    // Żądanie pozwolenia na iOS 13+
    const orientationApi = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    if (typeof orientationApi.requestPermission === "function") {
      orientationApi
        .requestPermission()
        .then((permission: string) => {
          if (permission === "granted") {
            setPermissionDenied(false);
          } else {
            setPermissionDenied(true);
            setSupported(false);
          }
        })
        .catch(() => {
          setPermissionDenied(true);
          setSupported(false);
        });
    }

    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, [open]);

  const sendel = Math.abs(angle) <= 5 ? angle : angle > 0 ? 1 : -1;
  const dropPerMeter = (angle * 100) / 5.71; // 1cm na 1cm = 1/57.3 rad ≈ 1°
  const dropPercent = Math.round(dropPerMeter);

  function save() {
    onSelect(angle);
    onOpenChange(false);
    toast.success(`Poziomnica: ${angle.toFixed(2)}° (spadek ${Math.round(dropPerMeter)}% na 1m)`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="gap-0 p-0 sm:max-w-sm" data-testid="level-meter">
        <div className="border-b border-border px-5 pb-4 pt-5">
          <DialogTitle className="flex items-center gap-2 font-display text-lg">
            <Maximize2 className="h-5 w-5 shrink-0 text-primary-ink" aria-hidden />
            Poziomnica
          </DialogTitle>
          <DialogDescription className="text-xs">Pomieszanie kąta nachylenia rury (B3.4)</DialogDescription>
        </div>

        <div className="space-y-4 px-5 py-4">
          {!supported ? (
            <div className="flex gap-3 rounded-card border border-warning bg-warning/5 p-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-warning-ink" aria-hidden />
              <div className="text-sm">
                {permissionDenied
                  ? "Odmówiono dostępu do sensora. Włącz w ustawieniach przeglądarki."
                  : "Sensor orientacji niedostępny na tym urządzeniu."}
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-card border border-border bg-muted p-6 text-center">
                <div className="text-5xl font-bold font-mono tabular-nums text-foreground">{angle.toFixed(1)}°</div>
                <p className="ui-hint mt-2">Kąt nachylenia</p>
              </div>

              <div className="rounded-card border border-border bg-muted p-4">
                <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                  <span>Spadek na 1 metr</span>
                  <span className="font-mono tabular-nums">{dropPercent}%</span>
                </div>
                <div
                  className="h-8 overflow-hidden rounded-field border border-border bg-background"
                  role="progressbar"
                  aria-valuemin={-45}
                  aria-valuemax={45}
                  aria-valuenow={angle}
                >
                  <div
                    className="h-full bg-gradient-to-r from-primary via-primary to-primary transition-[width]"
                    style={{
                      width: `${Math.max(0, Math.min(100, ((angle + 45) / 90) * 100))}%`,
                    }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-2xs text-muted-foreground font-mono">
                  <span>-45°</span>
                  <span>0°</span>
                  <span>45°</span>
                </div>
              </div>

              <p className="text-2xs text-muted-foreground">
                Przyłóż urządzenie do rury wzdłuż spadku. Poziomo = 0°. Przechył w przód = +, w tył = −.
              </p>
            </>
          )}
        </div>

        <ResponsiveDialogFooter className="grid grid-cols-2 gap-2 border-t border-border px-5 pb-5 pt-4">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="coarse:h-11">
            Anuluj
          </Button>
          <Button type="button" onClick={save} disabled={!supported} className="coarse:h-11">
            Zapisz
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </Dialog>
  );
}
