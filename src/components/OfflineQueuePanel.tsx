import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CloudOff, RefreshCw, Check, Pencil, Trash2, FilePlus2, Clock,
} from "lucide-react";
import {
  QUEUE_EVENT,
  getLastSyncAt,
  getQueue,
  opLabel,
  requestRetry,
  type QueueEventDetail,
  type QueuedOp,
} from "@/lib/offlineQueue";
import { cn } from "@/lib/utils";

const timeFmt = new Intl.DateTimeFormat("pl-PL", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const dateFmt = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function plural(n: number, one: string, few: string, many: string) {
  if (n === 1) return one;
  const rem10 = n % 10;
  const rem100 = n % 100;
  if (rem10 >= 2 && rem10 <= 4 && (rem100 < 12 || rem100 > 14)) return few;
  return many;
}

function opMeta(op: QueuedOp): { label: string; Icon: typeof Pencil; className: string } {
  switch (op.type) {
    case "upsert":
      return { label: "Zapis notatki", Icon: FilePlus2, className: "text-primary bg-primary/10" };
    case "patch":
      return { label: "Edycja notatki", Icon: Pencil, className: "text-foreground bg-muted" };
    case "delete":
      return { label: "Usunięcie notatki", Icon: Trash2, className: "text-destructive bg-destructive/10" };
  }
}

interface OfflineQueuePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Bottom sheet listing every change waiting in the offline queue, the current
 * sync status, the last successful sync time, and a manual "retry now" button.
 */
export function OfflineQueuePanel({ open, onOpenChange }: OfflineQueuePanelProps) {
  const [ops, setOps] = useState<QueuedOp[]>(() => getQueue());
  const [lastSync, setLastSync] = useState<number | null>(() => getLastSyncAt());
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const onQueue = (event: Event) => {
      const detail = (event as CustomEvent<QueueEventDetail>).detail;
      setOps(getQueue());
      if (detail?.lastSyncAt) setLastSync(detail.lastSyncAt);
      setRetrying(false);
    };
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    window.addEventListener(QUEUE_EVENT, onQueue as EventListener);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener(QUEUE_EVENT, onQueue as EventListener);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Refresh whenever the panel opens (covers edits made while it was closed).
  useEffect(() => {
    if (open) {
      setOps(getQueue());
      setLastSync(getLastSyncAt());
    }
  }, [open]);

  const handleRetry = () => {
    setRetrying(true);
    requestRetry();
    // Safety: if nothing responds (e.g. storage error), stop the spinner.
    window.setTimeout(() => setRetrying(false), 3000);
  };

  const status = offline
    ? { Icon: CloudOff, text: "Offline — zmiany zapisują się lokalnie", className: "text-destructive" }
    : ops.length > 0
      ? { Icon: RefreshCw, text: "Synchronizacja w toku…", className: "text-muted-foreground" }
      : { Icon: Check, text: "Wszystko zsynchronizowane", className: "text-primary" };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl pb-[calc(env(safe-area-inset-bottom)+16px)] border-t border-border/60">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display">Kolejka synchronizacji</SheetTitle>
          <SheetDescription>
            {ops.length
              ? `${ops.length} ${plural(ops.length, "zmiana czeka", "zmiany czekają", "zmian czeka")} na zapisanie`
              : "Brak oczekujących zmian"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-3 flex items-center gap-2 rounded-xl bg-muted/50 border border-border/50 px-3 py-2 text-sm">
          <status.Icon className={cn("h-4 w-4 shrink-0", status.className, ops.length > 0 && !offline && "animate-spin")} />
          <span className={cn("flex-1 truncate", status.className)}>{status.text}</span>
          {lastSync && (
            <span className="shrink-0 text-xs text-muted-foreground">
              Ost. sync {dateFmt.format(new Date(lastSync))}
            </span>
          )}
        </div>

        <ScrollArea className="mt-3 max-h-[40vh]">
          {ops.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Kolejka jest pusta — wszystkie notatki są zapisane.
            </p>
          ) : (
            <ul className="space-y-1.5 pr-2">
              {[...ops].reverse().map((op) => {
                const meta = opMeta(op);
                return (
                  <li
                    key={op.seq}
                    className="flex items-center gap-3 rounded-xl border border-border/40 bg-background/60 px-3 py-2"
                  >
                    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", meta.className)}>
                      <meta.Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{opLabel(op)}</span>
                      <span className="block text-xs text-muted-foreground">{meta.label}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {timeFmt.format(new Date(op.ts))}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>

        <Button
          className="mt-4 w-full"
          disabled={offline || ops.length === 0 || retrying}
          onClick={handleRetry}
        >
          <RefreshCw className={cn("mr-2 h-4 w-4", retrying && "animate-spin")} />
          {offline ? "Brak połączenia" : retrying ? "Synchronizuję…" : "Synchronizuj teraz"}
        </Button>
      </SheetContent>
    </Sheet>
  );
}
