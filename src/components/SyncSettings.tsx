import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Wifi, WifiOff, Copy, Check, LogOut } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  useSyncState, startPairing, joinWithCode, pauseSync, resumeSync, forgetPairing,
} from "@/lib/yjsSync";

interface Props {
  prefillCode?: string;
}

/** Polish plural of "urządzenie" (device) for a count — e.g. 1 urządzenie, 2 urządzenia, 5 urządzeń. */
function deviceWord(n: number): string {
  if (n === 1) return "urządzenie";
  const lastDigit = n % 10;
  const lastTwo = n % 100;
  if (lastDigit >= 2 && lastDigit <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return "urządzenia";
  return "urządzeń";
}

export function SyncSettings({ prefillCode }: Props) {
  const syncState = useSyncState();
  const [joinInput, setJoinInput] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (prefillCode) setJoinInput(prefillCode.toUpperCase());
  }, [prefillCode]);

  function handleToggle(checked: boolean) {
    if (checked) {
      if (syncState.code) resumeSync();
      else startPairing();
    } else {
      pauseSync();
    }
  }

  function handleJoin() {
    const trimmed = joinInput.trim();
    if (!trimmed) return;
    joinWithCode(trimmed);
    toast.success("Dołączono do grupy synchronizacji");
  }

  function handleForget() {
    forgetPairing();
    setJoinInput("");
    toast.success("Opuszczono grupę synchronizacji");
  }

  async function handleCopy() {
    if (!syncState.code) return;
    try {
      await navigator.clipboard.writeText(syncState.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Nie udało się skopiować kodu");
    }
  }

  const pairUrl = syncState.code
    ? `${window.location.origin}${window.location.pathname}?pair=${syncState.code}`
    : "";

  const statusLabel =
    syncState.status === "connected" && syncState.peerCount > 0
      ? `Połączono — ${syncState.peerCount} ${deviceWord(syncState.peerCount)}`
      : syncState.status === "connected" || syncState.status === "connecting"
        ? "Aktywna — szukanie urządzeń…"
        : "Wyłączona";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
        <div className="flex items-start gap-3 min-w-0">
          {syncState.status !== "disabled" ? (
            <Wifi className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          ) : (
            <WifiOff className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold">Synchronizacja między urządzeniami</p>
            <p className="text-xs text-muted-foreground mt-0.5">{statusLabel}</p>
          </div>
        </div>
        <Switch checked={syncState.status !== "disabled"} onCheckedChange={handleToggle} />
      </div>

      {syncState.code && (
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3 text-center">
          <p className="text-xs text-muted-foreground">
            Zeskanuj kod aparatem na drugim urządzeniu albo wpisz go ręcznie poniżej.
          </p>
          <div className="flex justify-center">
            <div className="bg-white p-2 rounded-lg">
              <QRCodeSVG value={pairUrl} size={140} />
            </div>
          </div>
          <div className="flex items-center justify-center gap-2">
            <code className="text-lg font-mono font-bold tracking-widest">{syncState.code}</code>
            <Button type="button" size="sm" variant="ghost" onClick={handleCopy} className="h-7 px-2">
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </Button>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={handleForget} className="text-muted-foreground hover:text-destructive gap-1.5">
            <LogOut className="w-3.5 h-3.5" /> Zapomnij i zacznij od nowa
          </Button>
        </div>
      )}

      <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dołącz do istniejącej grupy</p>
        <div className="flex gap-2">
          <Input
            value={joinInput}
            onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
            placeholder="Kod z innego urządzenia"
            className="font-mono tracking-widest"
            maxLength={8}
          />
          <Button type="button" onClick={handleJoin} disabled={!joinInput.trim()}>Dołącz</Button>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground">💡 Jak to działa</p>
        <p>
          Synchronizacja łączy się bezpośrednio między urządzeniami (peer-to-peer) — nie ma żadnej
          chmury ani konta. Publiczne serwery Yjs służą tylko do nawiązania połączenia, treść
          notatek nigdy przez nie nie przechodzi. Oba urządzenia muszą być online w tym samym
          momencie, żeby zmiany się wymieniły — jeśli jedno jest offline, zsynchronizuje się przy
          najbliższej okazji, gdy oba znów będą online razem. Pierwsza synchronizacja łączy
          notatki z obu urządzeń, nic nie zostanie skasowane. Obrazy w notatkach na razie nie są
          synchronizowane między urządzeniami.
        </p>
      </div>
    </div>
  );
}
