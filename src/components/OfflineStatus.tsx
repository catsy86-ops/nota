import { useEffect, useRef, useState } from "react";
import { CloudOff, Wifi, Loader2, Check, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { OfflineQueuePanel } from "@/components/OfflineQueuePanel";
import { useSyncState } from "@/lib/yjsSync";
import { hasUnsavedWork, useSaveStatus } from "@/lib/saveStatus";

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

  const save = useSaveStatus();

  // „Zapisywanie…” pokazujemy dopiero, gdy zapis trwa zauważalnie — zwykle kończy się w kilka ms.
  const [slowSave, setSlowSave] = useState(false);
  useEffect(() => {
    if (save.phase !== "saving") { setSlowSave(false); return; }
    const t = setTimeout(() => setSlowSave(true), 400);
    return () => clearTimeout(t);
  }, [save.phase]);

  // Zamknięcie karty z niezapisanymi zmianami: natywne ostrzeżenie przeglądarki.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedWork()) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const syncing = syncState.status === "connecting";
  const saveFailed = save.phase === "error";
  const saving = save.phase === "saving" && slowSave;
  const saved = save.phase === "saved";
  const visible = saveFailed || offline || saving || saved || syncing;
  if (!visible) return null;

  const label = saveFailed
    ? "Nie zapisano — zmiany są tylko w tej karcie"
    : saving ? "Zapisywanie…"
    : offline ? "Offline — zapisuję lokalnie"
    : saved ? "Zapisano"
    : "Łączenie z urządzeniami…";
  // Sam komunikat o zapisie nie jest przyciskiem — nie może przesłaniać kliknięć pod sobą.
  const passive = !saveFailed && !offline && (saving || saved);

  return (
    <>
      <button
        type="button"
        role="status"
        aria-live="polite"
        onClick={() => setPanelOpen(true)}
        aria-label="Otwórz status zapisu i synchronizacji"
        className={`glass-strong fixed bottom-24 left-1/2 z-50 flex max-w-[92vw] -translate-x-1/2 items-center gap-2 rounded-full border border-border/60 px-3 py-1.5 text-xs text-muted-foreground shadow-lg transition-colors hover:text-foreground sm:bottom-6 ${passive ? "pointer-events-none" : "cursor-pointer"}`}
      >
        {saveFailed ? (
          <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-destructive" />
        ) : offline ? (
          <CloudOff className="h-3.5 w-3.5 shrink-0 text-destructive" />
        ) : saved && !saving ? (
          <Check className="h-3.5 w-3.5 shrink-0 text-primary-ink" />
        ) : (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
        )}
        <span className="truncate">{label}</span>
      </button>
      <OfflineQueuePanel open={panelOpen} onOpenChange={setPanelOpen} offline={offline} />
    </>
  );
}
