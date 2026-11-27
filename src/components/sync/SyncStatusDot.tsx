import { useEffect, useState } from "react";
import { useOnline } from "@/hooks/useOnline";
import { useSyncState } from "@/lib/yjsSync";
import { syncIndicatorText, syncTone } from "@/lib/sync/syncIndicator";
import { cn } from "@/lib/utils";

/** Chwila przejścia w offline (dla „Offline od 14:02”); `null`, gdy jesteśmy online. */
function useOfflineSince(online: boolean): number | null {
  const [since, setSince] = useState<number | null>(() => (online ? null : Date.now()));
  useEffect(() => { setSince((prev) => (online ? null : prev ?? Date.now())); }, [online]);
  return since;
}

/**
 * Jeden wskaźnik stanu synchronizacji w nagłówku (Powłoka 2.4, Q4.1). Tylko gdy urządzenie jest w grupie —
 * zapis lokalny pokazuje pigułka zapisu (`OfflineStatus`), która nie powtarza już stanu synchronizacji.
 * Kropka niesie kolor, napis obok (od `sm`) to samo słowami; na telefonie sama kropka z pełną nazwą.
 * Stuknięcie otwiera Ustawienia → Sync (urządzenia, ostatni kontakt, wersje, format danych).
 */
export function SyncStatusDot({ onOpenSync }: { onOpenSync: () => void }) {
  const state = useSyncState();
  const online = useOnline();
  const offlineSince = useOfflineSince(online);
  if (state.status === "disabled") return null;

  const tone = syncTone(state, online);
  const { short, label } = syncIndicatorText(tone, state.peerCount, offlineSince);
  const color = { connected: "bg-success", connecting: "bg-muted-foreground motion-safe:animate-pulse", offline: "bg-warning", error: "bg-destructive", rekeyed: "bg-destructive" }[tone];

  return (
    <button type="button" onClick={onOpenSync} aria-label={label} title={label} data-tone={tone}
      className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-1 text-xs text-muted-foreground outline-hidden hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:px-2">
      <span className={cn("size-2.5 shrink-0 rounded-full", color)} aria-hidden />
      <span className="hidden max-w-40 truncate sm:inline" aria-hidden>{short}</span>
    </button>
  );
}
