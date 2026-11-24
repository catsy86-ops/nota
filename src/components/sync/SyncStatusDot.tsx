import { useOnline } from "@/hooks/useOnline";
import { useSyncState } from "@/lib/yjsSync";
import { cn } from "@/lib/utils";

/**
 * Kropka stanu synchronizacji w nagłówku (plan Powłoki 2.4). Tylko gdy urządzenie jest w grupie.
 * Zielona — połączono; szara — łączenie; żółta — offline (zmiany czekają); czerwona — błąd albo kod zmieniony
 * na innym urządzeniu (`rekeyed`: synchronizacja stoi).
 * Stuknięcie otwiera Ustawienia na karcie Synchronizacja.
 */
export function SyncStatusDot({ onOpenSync }: { onOpenSync: () => void }) {
  const state = useSyncState();
  const online = useOnline();
  if (state.status === "disabled") return null;

  const tone = state.status === "rekeyed" ? "rekeyed" : !online ? "offline" : state.lastError ? "error" : state.status === "connected" ? "connected" : "connecting";
  const label = {
    connected: "Synchronizacja: połączono",
    connecting: "Synchronizacja: łączenie",
    offline: "Synchronizacja: offline, zmiany czekają",
    error: "Synchronizacja: błąd",
    rekeyed: "Synchronizacja wstrzymana: kod zmieniono na innym urządzeniu",
  }[tone];
  const color = { connected: "bg-success", connecting: "bg-muted-foreground", offline: "bg-warning", error: "bg-destructive", rekeyed: "bg-destructive" }[tone];

  return (
    <button type="button" onClick={onOpenSync} aria-label={label} title={label} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
      <span className={cn("size-2.5 rounded-full", color)} aria-hidden />
    </button>
  );
}
