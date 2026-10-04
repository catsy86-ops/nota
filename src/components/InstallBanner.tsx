import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Smartphone, X } from "lucide-react";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { InstallAppButton } from "@/components/InstallAppButton";

const DISMISS_KEY = "kaczy.installBanner.dismissed.v1";

function readDismissed(): boolean {
  try { return localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
}

/**
 * Zaproszenie do instalacji na telefonie (tylko wąskie ekrany). Przycisk
 * w menu „Więcej” jest za mało widoczny; baner znika po instalacji albo
 * po zamknięciu — wtedy instalacja zostaje w „Więcej”.
 */
export function InstallBanner() {
  const { canInstall } = usePwaInstall();
  const [dismissed, setDismissed] = useState(readDismissed);

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
  };

  return (
    <AnimatePresence>
      {canInstall && !dismissed && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0 }}
          className="md:hidden flex items-start gap-3 rounded-2xl border border-primary/25 bg-primary/5 p-3"
        >
          <span className="w-9 h-9 shrink-0 rounded-xl bg-primary/15 text-primary grid place-items-center">
            <Smartphone className="w-[18px] h-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold font-display leading-tight">Zainstaluj NOTKI na telefonie</p>
            <p className="text-xs text-muted-foreground mt-0.5">Ikona na ekranie głównym, działa bez internetu.</p>
            <InstallAppButton variant="compact" onDone={dismiss} className="mt-2.5" />
          </div>
          <button type="button" onClick={dismiss} aria-label="Ukryj baner instalacji" className="p-1.5 -mr-1.5 -mt-1.5 rounded-lg text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
