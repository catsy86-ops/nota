import { useEffect, useRef, useState } from "react";
import { CloudOff, Wifi, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { OfflineQueuePanel } from "@/components/OfflineQueuePanel";
import { useSyncState } from "@/lib/yjsSync";

/**
 * Status pill for connectivity and device-to-device sync. Notes themselves
 * are saved to IndexedDB instantly regardless of network state (Yjs — see
 * roadmap.md), so there is no write queue to report here anymore; this only
 * reflects internet connectivity and the opt-in P2P sync link.
 */
export function OfflineStatus() {
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);
  const [panelOpen, setPanelOpen] = useState(false);
  const syncState = useSyncState();

  const wasOfflineRef = useRef(offline);

  useEffect(() => {
    const goOnline = () => {
      setOffline(false);
      if (wasOfflineRef.current) {
        toast("Połączenie wróciło", { icon: <Wifi className="h-4 w-4" /> });
      }
      wasOfflineRef.current = false;
    };

    const goOffline = () => {
      setOffline(true);
      wasOfflineRef.current = true;
      toast("Jesteś offline", {
        description: "Notatki nadal zapisują się lokalnie.",
        icon: <CloudOff className="h-4 w-4" />,
        duration: 6000,
      });
    };

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const syncing = syncState.status === "connecting";
  const visible = offline || syncing;
  if (!visible) return null;

  const label = offline ? "Offline — zapisuję lokalnie" : "Łączenie z urządzeniami…";

  return (
    <>
      <button
        type="button"
        role="status"
        aria-live="polite"
        onClick={() => setPanelOpen(true)}
        aria-label="Otwórz status zapisu i synchronizacji"
        className="glass-strong fixed bottom-24 left-1/2 z-50 flex max-w-[92vw] -translate-x-1/2 cursor-pointer items-center gap-2 rounded-full border border-border/60 px-3 py-1.5 text-xs text-muted-foreground shadow-lg transition-colors hover:text-foreground sm:bottom-6"
      >
        {offline ? (
          <CloudOff className="h-3.5 w-3.5 shrink-0 text-destructive" />
        ) : (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
        )}
        <span className="truncate">{label}</span>
      </button>
      <OfflineQueuePanel open={panelOpen} onOpenChange={setPanelOpen} offline={offline} />
    </>
  );
}
