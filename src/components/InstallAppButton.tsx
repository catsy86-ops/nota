import { useState, type ReactNode } from "react";
import { Download, CircleCheck, Share, SquarePlus, EllipsisVertical, WifiOff, MonitorDown } from "lucide-react";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { SidebarRow } from "@/components/sidebar/SidebarRow";

interface InstallAppButtonProps {
  /** "row" = sidebar-style row, "tile" = bottom-sheet tile, "compact" = small pill (banner) */
  variant?: "row" | "tile" | "compact";
  onDone?: () => void;
  className?: string;
}

type Step = { icon: ReactNode; text: ReactNode };

const STEP_ICON = "w-7 h-7 shrink-0 rounded-field bg-muted flex items-center justify-center text-primary-ink";

function manualSteps(isIos: boolean, isAndroid: boolean): { intro: string; steps: Step[] } {
  if (isIos) {
    return {
      intro: "Na iPhonie instaluje się ręcznie, w Safari:",
      steps: [
        { icon: <Share className="w-4 h-4" />, text: <>Dotknij przycisku <strong>Udostępnij</strong> na pasku Safari.</> },
        { icon: <SquarePlus className="w-4 h-4" />, text: <>Wybierz <strong>„Do ekranu początkowego”</strong>.</> },
        { icon: <CircleCheck className="w-4 h-4" />, text: <>Potwierdź przyciskiem <strong>Dodaj</strong>.</> },
      ],
    };
  }
  if (isAndroid) {
    return {
      intro: "Przeglądarka nie pokazała okna instalacji — zrób to z jej menu:",
      steps: [
        { icon: <EllipsisVertical className="w-4 h-4" />, text: <>Otwórz menu przeglądarki <strong>⋮</strong> (prawy górny róg).</> },
        { icon: <Download className="w-4 h-4" />, text: <>Wybierz <strong>„Zainstaluj aplikację”</strong> albo <strong>„Dodaj do ekranu głównego”</strong>.</> },
        { icon: <CircleCheck className="w-4 h-4" />, text: <>Potwierdź — ikona G pojawi się na ekranie głównym.</> },
      ],
    };
  }
  return {
    intro: "Zainstaluj z paska adresu przeglądarki (Chrome, Edge):",
    steps: [
      { icon: <MonitorDown className="w-4 h-4" />, text: <>Kliknij ikonę <strong>instalacji</strong> po prawej stronie paska adresu.</> },
      { icon: <CircleCheck className="w-4 h-4" />, text: <>Potwierdź <strong>Zainstaluj</strong>. Na telefonie otwórz tę stronę i użyj tego samego przycisku.</> },
    ],
  };
}

/**
 * PWA install entry point. Shows the native install prompt where supported,
 * manual steps everywhere else, and hides itself once the app is installed.
 */
export function InstallAppButton({ variant = "row", onDone, className }: InstallAppButtonProps) {
  const { canInstall, isInstalled, isIos, isAndroid, hasNativePrompt, install } = usePwaInstall();
  const [helpOpen, setHelpOpen] = useState(false);

  if (isInstalled || !canInstall) return null;

  const handleClick = async () => {
    if (!hasNativePrompt) {
      setHelpOpen(true);
      return;
    }
    const outcome = await install();
    if (outcome === "accepted") {
      toast.success("Zainstalowano! 🎉", { description: "G są teraz na ekranie głównym." });
      onDone?.();
    }
  };

  const help = manualSteps(isIos, isAndroid);

  const button =
    variant === "compact" ? (
      <button
        onClick={handleClick}
        className={cn("pressable shrink-0 px-3 h-9 rounded-card text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors", className)}
      >
        Zainstaluj
      </button>
    ) : variant === "tile" ? (
      <button
        onClick={handleClick}
        className={cn(
          "pressable relative flex flex-col items-center gap-1.5 p-3 rounded-card bg-muted/50 hover:bg-muted transition-colors border border-border/50",
          className
        )}
      >
        <span className="w-10 h-10 rounded-card bg-background flex items-center justify-center text-primary-ink">
          <Download className="w-5 h-5" />
        </span>
        <span className="text-xs font-medium font-display text-foreground">Zainstaluj</span>
      </button>
    ) : (
      // Zwykły wiersz paska — cichy jak reszta; ikona w kolorze podpowiada akcję.
      <SidebarRow
        icon={<Download className="w-[18px] h-[18px] text-primary-ink" />}
        label="Zainstaluj aplikację"
        onClick={handleClick}
        className={className}
      />
    );

  return (
    <>
      {button}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Download className="w-5 h-5 text-primary-ink" /> Zainstaluj hydra
            </DialogTitle>
            <DialogDescription>{help.intro}</DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm text-foreground pt-1">
            {help.steps.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className={STEP_ICON}>{step.icon}</span>
                <span className="pt-1">{step.text}</span>
              </li>
            ))}
          </ol>
          <p className="flex items-center gap-2 text-xs text-muted-foreground border-t border-border/60 pt-3">
            <WifiOff className="w-3.5 h-3.5 shrink-0" />
            Zainstalowana aplikacja działa bez internetu — notatki są zapisane na urządzeniu.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
