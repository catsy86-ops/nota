import { useSyncExternalStore } from "react";
import { useSyncState } from "@/lib/yjsSync";
import { cn } from "@/lib/utils";

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => { window.removeEventListener("online", cb); window.removeEventListener("offline", cb); };
}

/**
 * Kropka stanu synchronizacji w nagłówku (plan Powłoki 2.4). Tylko gdy urządzenie jest w grupie.
 * Zielona — połączono; szara — łączenie; żółta — offline (zmiany czekają); czerwona — błąd.
 * Stuknięcie otwiera Ustawienia na karcie Synchronizacja.
 */
export function SyncStatusDot({ onOpenSync }: { onOpenSync: () => void }) {
  const state = useSyncState();
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  if (state.status === "disabled") return null;

  const tone = !online ? "offline" : state.lastError ? "error" : state.status === "connected" ? "connected" : "connecting";
  const label = {
    connected: "Synchronizacja: połączono",
    connecting: "Synchronizacja: łączenie",
    offline: "Synchronizacja: offline, zmiany czekają",
    error: "Synchronizacja: błąd",
  }[tone];
  const color = { connected: "bg-success", connecting: "bg-muted-foreground", offline: "bg-warning", error: "bg-destructive" }[tone];

  return (
    <button type="button" onClick={onOpenSync} aria-label={label} title={label} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
      <span className={cn("h-2.5 w-2.5 rounded-full", color)} aria-hidden />
    </button>
  );
}
