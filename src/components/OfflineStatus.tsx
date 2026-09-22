import { useEffect, useRef, useState } from "react";
import { CloudOff, RefreshCw, Check, CloudUpload } from "lucide-react";
import { toast } from "sonner";
import {
  QUEUE_EVENT,
  getLastSyncAt,
  getQueue,
  opLabel,
  pendingCount,
  type QueueEventDetail,
  type QueuedOp,
} from "@/lib/offlineQueue";
import { OfflineQueuePanel } from "@/components/OfflineQueuePanel";

const timeFmt = new Intl.DateTimeFormat("pl-PL", { hour: "2-digit", minute: "2-digit" });

function fmtTime(ts: number | null) {
  return ts ? timeFmt.format(new Date(ts)) : "—";
}

function plural(n: number, one: string, few: string, many: string) {
  if (n === 1) return one;
  const rem10 = n % 10;
  const rem100 = n % 100;
  if (rem10 >= 2 && rem10 <= 4 && (rem100 < 12 || rem100 > 14)) return few;
  return many;
}

/** "Lista zakupów, Pomysły i 2 inne" */
function describe(ops: QueuedOp[]): string {
  const names = Array.from(new Set(ops.map(opLabel)));
  if (names.length <= 2) return names.join(", ");
  const rest = names.length - 2;
  return `${names.slice(0, 2).join(", ")} i ${rest} ${plural(rest, "inna", "inne", "innych")}`;
}

/**
 * Status pill + toasts for the offline write queue: what exactly was saved
 * and when the queue was last fully synced.
 */
export function OfflineStatus() {
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);
  const [pending, setPending] = useState(0);
  const [lastSync, setLastSync] = useState<number | null>(() => getLastSyncAt());
  const [recent, setRecent] = useState<string>("");
  const [justSynced, setJustSynced] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  const wasOfflineSinceSync = useRef(typeof navigator !== "undefined" && !navigator.onLine);
  const peakPending = useRef(0);
  const syncedTimer = useRef<number>();

  useEffect(() => {
    const onQueue = (event: Event) => {
      const detail = (event as CustomEvent<QueueEventDetail>).detail;
      const n = detail?.pending ?? pendingCount();
      const confirmed = detail?.confirmed ?? [];
      peakPending.current = Math.max(peakPending.current, n, confirmed.length);
      setPending(n);

      if (confirmed.length && n === 0) {
        const at = detail?.lastSyncAt ?? Date.now();
        setLastSync(at);
        setRecent(describe(confirmed));
        setJustSynced(true);
        window.clearTimeout(syncedTimer.current);
        syncedTimer.current = window.setTimeout(() => setJustSynced(false), 4000);

        // Only announce loudly when it actually mattered: a backlog or an
        // offline stretch. Ordinary single saves stay silent in the pill.
        if (wasOfflineSinceSync.current || peakPending.current > 1) {
          const count = confirmed.length;
          toast.success(
            `Zsynchronizowano ${count} ${plural(count, "zmianę", "zmiany", "zmian")}`,
            { description: `${describe(confirmed)} • ${fmtTime(at)}`, duration: 5000 },
          );
        }
        wasOfflineSinceSync.current = false;
        peakPending.current = 0;
      }
    };

    const goOnline = () => {
      setOffline(false);
      const waiting = pendingCount();
      toast("Połączenie wróciło", {
        description: waiting
          ? `Synchronizuję ${waiting} ${plural(waiting, "zmianę", "zmiany", "zmian")}…`
          : "Wszystko jest już zapisane.",
        icon: <CloudUpload className="h-4 w-4" />,
      });
    };

    const goOffline = () => {
      setOffline(true);
      wasOfflineSinceSync.current = true;
      const waiting = getQueue();
      toast("Jesteś offline", {
        description: waiting.length
          ? `Zmiany czekają w kolejce: ${describe(waiting)}`
          : "Kolejne zmiany zapiszą się lokalnie i wyślą po powrocie sieci.",
        icon: <CloudOff className="h-4 w-4" />,
        duration: 6000,
      });
    };

    setPending(pendingCount());
    window.addEventListener(QUEUE_EVENT, onQueue as EventListener);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.clearTimeout(syncedTimer.current);
      window.removeEventListener(QUEUE_EVENT, onQueue as EventListener);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const visible = offline || pending > 0 || justSynced;
  if (!visible) return null;

  let label: string;
  let hint: string | null = null;

  if (offline) {
    label = pending > 0
      ? `Offline — ${pending} ${plural(pending, "zmiana", "zmiany", "zmian")} w kolejce`
      : "Offline — zapisuję lokalnie";
    hint = lastSync ? `Ostatnia synchronizacja ${fmtTime(lastSync)}` : null;
  } else if (pending > 0) {
    label = `Zapisywanie ${pending} ${plural(pending, "zmiany", "zmian", "zmian")}…`;
  } else {
    label = `Zapisano o ${fmtTime(lastSync)}`;
    hint = recent || null;
  }

  return (
    <>
    <button
      type="button"
      role="status"
      aria-live="polite"
      onClick={() => setPanelOpen(true)}
      aria-label="Otwórz kolejkę synchronizacji"
      className="glass-strong fixed bottom-24 left-1/2 z-50 flex max-w-[92vw] -translate-x-1/2 cursor-pointer items-center gap-2 rounded-full border border-border/60 px-3 py-1.5 text-xs text-muted-foreground shadow-lg transition-colors hover:text-foreground sm:bottom-6"
    >
      {offline ? (
        <CloudOff className="h-3.5 w-3.5 shrink-0 text-destructive" />
      ) : pending > 0 ? (
        <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin" />
      ) : (
        <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
      )}
      <span className="truncate">{label}</span>
      {hint && (
        <span className="hidden truncate border-l border-border/60 pl-2 text-muted-foreground/70 sm:inline">
          {hint}
        </span>
      )}
    </button>
    <OfflineQueuePanel open={panelOpen} onOpenChange={setPanelOpen} />
    </>
  );
}
