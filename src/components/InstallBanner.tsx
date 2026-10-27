import { useState } from "react";
import { AnimatePresence, m as motion } from "framer-motion";
import { NotkiLogo } from "@/components/NotkiLogo";
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
 * po zamknięciu — wtedy instalacja zostaje w „Więcej”. `ready`: dopiero
 * gdy ktoś już notuje — przy pierwszym wejściu konkurował z pustym widokiem.
 */
export function InstallBanner({ ready }: { ready: boolean }) {
  const { canInstall } = usePwaInstall();
  const [dismissed, setDismissed] = useState(readDismissed);

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
  };

  return (
    <AnimatePresence>
      {ready && canInstall && !dismissed && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0 }}
          className="md:hidden flex items-center gap-2.5 rounded-card border border-primary/25 bg-primary/5 py-2 pl-3 pr-1.5"
        >
          <span className="w-8 h-8 shrink-0 rounded-card bg-primary/15 text-primary-ink grid place-items-center">
            <Smartphone className="w-4 h-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold font-display leading-tight truncate">Zainstaluj <NotkiLogo size="sm" /></p>
            <p className="text-xs text-muted-foreground truncate">Działa bez internetu</p>
          </div>
          <InstallAppButton variant="compact" onDone={dismiss} />
          <button type="button" onClick={dismiss} aria-label="Ukryj baner instalacji" className="grid h-11 w-11 shrink-0 place-items-center rounded-field text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
