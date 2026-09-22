import { useState } from "react";
import { motion } from "framer-motion";
import { Download, CheckCircle2, Share, PlusSquare } from "lucide-react";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface InstallAppButtonProps {
  /** "row" = sidebar-style row, "tile" = bottom-sheet tile */
  variant?: "row" | "tile";
  onDone?: () => void;
  className?: string;
}

/**
 * PWA install entry point. Shows the native install prompt where supported,
 * manual instructions on iOS, and hides itself once the app is installed.
 */
export function InstallAppButton({ variant = "row", onDone, className }: InstallAppButtonProps) {
  const { canInstall, isInstalled, isIos, install } = usePwaInstall();
  const { toast } = useToast();
  const [iosHelpOpen, setIosHelpOpen] = useState(false);

  if (isInstalled || !canInstall) return null;

  const handleClick = async () => {
    if (isIos) {
      setIosHelpOpen(true);
      return;
    }
    const outcome = await install();
    if (outcome === "accepted") {
      toast({ title: "Zainstalowano! 🎉", description: "KACZY jest teraz na ekranie głównym." });
      onDone?.();
    }
  };

  const button =
    variant === "tile" ? (
      <motion.button
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleClick}
        className={cn(
          "relative flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-muted/50 hover:bg-muted transition-colors border border-border/50",
          className
        )}
      >
        <span className="w-10 h-10 rounded-xl bg-background flex items-center justify-center text-primary">
          <Download className="w-5 h-5" />
        </span>
        <span className="text-xs font-medium font-display text-foreground">Zainstaluj</span>
      </motion.button>
    ) : (
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleClick}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-primary bg-primary/10 hover:bg-primary/15 transition-all",
          className
        )}
      >
        <Download className="w-[18px] h-[18px]" />
        <span>Zainstaluj aplikację</span>
      </motion.button>
    );

  return (
    <>
      {button}
      <Dialog open={iosHelpOpen} onOpenChange={setIosHelpOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Download className="w-5 h-5 text-primary" /> Dodaj do ekranu głównego
            </DialogTitle>
            <DialogDescription>
              iOS nie pokazuje automatycznego promptu — zrób to ręcznie w Safari:
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm text-foreground pt-1">
            <li className="flex items-start gap-3">
              <span className="w-7 h-7 shrink-0 rounded-lg bg-muted flex items-center justify-center text-primary">
                <Share className="w-4 h-4" />
              </span>
              <span>1. Dotknij przycisku <strong>Udostępnij</strong> na pasku Safari.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-7 h-7 shrink-0 rounded-lg bg-muted flex items-center justify-center text-primary">
                <PlusSquare className="w-4 h-4" />
              </span>
              <span>2. Wybierz <strong>„Dodaj do ekranu głównego"</strong>.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-7 h-7 shrink-0 rounded-lg bg-muted flex items-center justify-center text-primary">
                <CheckCircle2 className="w-4 h-4" />
              </span>
              <span>3. Potwierdź przyciskiem <strong>Dodaj</strong> — gotowe! 🦆</span>
            </li>
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
}
