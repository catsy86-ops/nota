import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { CloudOff, Wifi, LoaderCircle, Check, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { useSyncState } from "@/lib/yjsSync";
import { hasUnsavedWork, useSaveStatus } from "@/lib/saveStatus";

// Panel otwiera się dopiero po stuknięciu pigułki — leniwie, poza główną paczką.
const OfflineQueuePanel = lazy(() => import("@/components/OfflineQueuePanel").then((m) => ({ default: m.OfflineQueuePanel })));

/**
 * Status pill for connectivity and device-to-device sync. Notes themselves
 * are saved to IndexedDB instantly regardless of network state (Yjs — see
 * roadmap.md), so there is no write queue to report here anymore; this only
 * reflects internet connectivity and the opt-in P2P sync link.
 */
export function OfflineStatus() {
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);
  const [panelOpen, setPanelOpen] = useState(false);
  // Montowany przy pierwszym otwarciu i zostaje — zamknięcie ma swoją animację.
  const [panelMounted, setPanelMounted] = useState(false);
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
      {/* Przycisk otwiera panel. W stanie biernym (zapisano) pigułka nie łapie fokusu. */}
      <button
        type="button"
        onClick={() => { setPanelMounted(true); setPanelOpen(true); }}
        aria-label={`Status zapisu i synchronizacji: ${label}`}
        tabIndex={passive ? -1 : undefined}
        className={`save-status glass-strong fixed bottom-24 left-1/2 z-50 flex max-w-[92vw] -translate-x-1/2 items-center gap-2 rounded-full border border-border/60 px-3 py-1.5 text-xs text-muted-foreground shadow-lg transition-colors hover:text-foreground sm:bottom-6 ${passive ? "pointer-events-none" : "cursor-pointer"}`}
      >
        {saveFailed ? (
          <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-destructive-ink" />
        ) : offline ? (
          <CloudOff className="h-3.5 w-3.5 shrink-0 text-destructive-ink" />
        ) : saved && !saving ? (
          <Check className="h-3.5 w-3.5 shrink-0 text-primary-ink" />
        ) : (
          <LoaderCircle className="h-3.5 w-3.5 shrink-0 animate-spin" />
        )}
        <span className="truncate">
          {label}
          {/* Ołówek: kreska rysuje się przy każdym zapisie (element wraca z `saved`). */}
          {saved && !saving && <span className="pencil-stroke" aria-hidden />}
        </span>
      </button>
      {/* Komunikat dla czytnika: zmiana stanu zapisu jest ogłaszana, a przycisk nie dostaje roli „status”.
          Z przedrostkiem, żeby tekst nie powielał widocznego napisu (testy szukają go dokładnie). */}
      <span role="status" aria-live="polite" className="sr-only">Stan zapisu: {label}</span>
      {panelMounted && <Suspense fallback={null}><OfflineQueuePanel open={panelOpen} onOpenChange={setPanelOpen} offline={offline} /></Suspense>}
    </>
  );
}
