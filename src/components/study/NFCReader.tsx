import { useEffect, useState } from "react";
import { AlertCircle, Radio, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveDialogContent, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";
import { hasNFC, readNFCTag } from "@/lib/nfc";
import { toast } from "sonner";

interface NFCReaderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (tag: string) => void;
}

export function NFCReader({ open, onOpenChange, onDetected }: NFCReaderProps) {
  const [tag, setTag] = useState("");
  const [supported, setSupported] = useState(true);
  const [reading, setReading] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (!hasNFC()) {
      setSupported(false);
      return;
    }

    const startReading = async () => {
      setReading(true);
      const detected = await readNFCTag();
      setReading(false);

      if (detected) {
        setTag(detected);
      } else {
        toast.error("Nie znaleziono tagu NFC");
      }
    };

    void startReading();
  }, [open]);

  function use() {
    if (!tag) return;
    onDetected(tag);
    onOpenChange(false);
    toast.success(`Odczytany tag: ${tag}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="gap-0 p-0 sm:max-w-sm" data-testid="nfc-reader">
        <div className="border-b border-border px-5 pb-4 pt-5">
          <DialogTitle className="flex items-center gap-2 font-display text-lg">
            <Radio className="h-5 w-5 shrink-0 text-primary-ink" aria-hidden />
            Odczytaj NFC
          </DialogTitle>
          <DialogDescription className="text-xs">Web NFC API (Chrome Android 89+) — (B3.11)</DialogDescription>
        </div>

        <div className="space-y-4 px-5 py-4 min-h-24">
          {!supported ? (
            <div className="flex gap-3 rounded-card border border-warning bg-warning/5 p-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-warning-ink" aria-hidden />
              <div className="text-sm">NFC niedostępne. Chrome Android 89+ lub inny przegląd z Web NFC.</div>
            </div>
          ) : reading ? (
            <div className="flex flex-col items-center justify-center py-6 gap-2">
              <div className="animate-pulse">
                <Radio className="h-8 w-8 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">Przytrzymaj tag przy telefonie…</p>
            </div>
          ) : tag ? (
            <div className="rounded-card border border-success bg-success/5 p-3">
              <p className="text-2xs text-muted-foreground mb-1">Odczytany tag:</p>
              <p className="font-mono text-sm text-foreground break-all">{tag}</p>
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground text-sm">Brak tagu</div>
          )}
        </div>

        <ResponsiveDialogFooter className="grid grid-cols-2 gap-2 border-t border-border px-5 pb-5 pt-4">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="coarse:h-11">
            <X className="mr-1 h-4 w-4" aria-hidden />
            Zamknij
          </Button>
          <Button type="button" onClick={use} disabled={!tag || !supported} className="coarse:h-11">
            Użyj
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </Dialog>
  );
}
