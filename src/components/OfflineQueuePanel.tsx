import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  CloudOff, Check, HardDrive, Wifi, WifiOff, } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSyncState } from "@/lib/yjsSync";
import { DelayedSpinner } from "@/components/DelayedSpinner";

/** Polish plural of "urządzenie" (device) for a count. */
function deviceWord(n: number): string {
  if (n === 1) return "urządzenie";
  const lastDigit = n % 10;
  const lastTwo = n % 100;
  if (lastDigit >= 2 && lastDigit <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return "urządzenia";
  return "urządzeń";
}

interface OfflineQueuePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offline: boolean;
}

/**
 * Bottom sheet with the real sync picture: notes are saved to IndexedDB
 * instantly (no write queue since the Yjs migration — see roadmap.md), and
 * device-to-device sync is a separate, opt-in P2P layer (yjsSync.ts).
 */
export function OfflineQueuePanel({ open, onOpenChange, offline }: OfflineQueuePanelProps) {
  const syncState = useSyncState();

  const peerLabel =
    syncState.status === "connected" && syncState.peerCount > 0
      ? `Połączono — ${syncState.peerCount} ${deviceWord(syncState.peerCount)}`
      : syncState.status === "connected" || syncState.status === "connecting"
        ? "Szukanie urządzeń…"
        : "Wyłączona";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" snap className="rounded-t-3xl pb-[calc(env(safe-area-inset-bottom)+16px)] border-t border-border/60">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display">Status zapisu i synchronizacji</SheetTitle>
          <SheetDescription>
            Co dzieje się z Twoimi notatkami — lokalnie i między urządzeniami.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-3 rounded-card bg-muted/50 border border-border/50 px-3 py-2.5 text-sm">
            {offline ? (
              <CloudOff className="h-4 w-4 shrink-0 text-destructive-ink" />
            ) : (
              <Wifi className="h-4 w-4 shrink-0 text-primary-ink" />
            )}
            <span className="flex-1">{offline ? "Brak połączenia z internetem" : "Połączenie z internetem jest aktywne"}</span>
          </div>

          <div className="flex items-center gap-3 rounded-card bg-muted/50 border border-border/50 px-3 py-2.5 text-sm">
            <HardDrive className="h-4 w-4 shrink-0 text-primary-ink" />
            <span className="flex-1">
              Notatki są zapisywane lokalnie natychmiast
              <span className="block text-xs text-muted-foreground">Działa też offline — nic nie czeka w kolejce.</span>
            </span>
            <Check className="h-4 w-4 shrink-0 text-primary-ink" />
          </div>

          <div className="flex items-center gap-3 rounded-card bg-muted/50 border border-border/50 px-3 py-2.5 text-sm">
            {syncState.status === "connecting" ? (
              <DelayedSpinner active className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : syncState.status === "connected" ? (
              <Wifi className="h-4 w-4 shrink-0 text-primary-ink" />
            ) : (
              <WifiOff className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span className="flex-1">
              Synchronizacja między urządzeniami
              <span className={cn("block text-xs", syncState.status === "connected" ? "text-primary-ink" : "text-muted-foreground")}>
                {peerLabel}
              </span>
            </span>
          </div>

          {syncState.status === "disabled" && (
            <p className="px-1 pt-1 text-xs text-muted-foreground">
              Włącz ją w Ustawieniach → zakładka „Sync”, aby sparować to urządzenie z innym.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
