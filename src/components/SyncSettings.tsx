import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Wifi, WifiOff, Copy, Check, LogOut } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";
import {
  useSyncState, type SyncState, startPairing, joinWithCode, pauseSync, resumeSync, forgetPairing, formatCode,
  getSignalingServers, setSignalingServers, parseSignalingList, wasShortCodeDropped, getLegacyRoom, setLegacyRoom,
  codeFromPaste, CODE_LENGTH, CODE_PATTERN,
} from "@/lib/yjsSync";

/** Jedno zdanie o tym, na którym etapie synchronizacja stoi (bez żargonu). */
function diagnosis(s: SyncState): string {
  if (s.lastError) return "Nie udało się uruchomić połączenia. Sprawdź internet i spróbuj ponownie.";
  if (s.status === "connected" && s.peerCount === 0) return "Połączono z serwerami. Drugie urządzenie jeszcze nie dołączyło — otwórz tu sam kod na nim.";
  if (s.signalingTotal > 0 && s.signalingUp === 0) return "Nie ma połączenia z serwerami wymiany. Sprawdź internet; połączenie wznowi się samo.";
  if (s.status === "connecting") return `Łączenie z serwerami (${s.signalingUp} z ${s.signalingTotal || "?"}).`;
  return "";
}

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
  const [forgetOpen, setForgetOpen] = useState(false);
  const [legacyRoom, setLegacyRoomState] = useState(() => getLegacyRoom());

  useEffect(() => {
    if (prefillCode) setJoinInput(codeFromPaste(prefillCode));
  }, [prefillCode]);

  function handleToggle(checked: boolean) {
    if (checked) {
      if (syncState.code) resumeSync();
      else startPairing();
    } else {
      pauseSync();
    }
  }

  const joinReady = joinInput.length === CODE_LENGTH;

  function handleJoin() {
    if (!joinReady) return;
    if (!joinWithCode(joinInput)) return;
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
            <Wifi className="w-5 h-5 text-primary-ink shrink-0 mt-0.5" />
          ) : (
            <WifiOff className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold">Synchronizacja między urządzeniami</p>
            <p className="text-xs text-muted-foreground mt-0.5">{statusLabel}</p>
            {syncState.status !== "disabled" && (
              <p className="text-xs text-muted-foreground mt-1" data-testid="sync-diagnosis">{diagnosis(syncState)}</p>
            )}
            {syncState.status !== "disabled" && (
              <p className="text-2xs text-muted-foreground mt-0.5">
                {syncState.lastSyncedAt
                  ? `Ostatnia zmiana z innego urządzenia: ${formatDistanceToNow(syncState.lastSyncedAt, { addSuffix: true, locale: pl })}`
                  : "W tej sesji nie przyszła jeszcze żadna zmiana z innego urządzenia"}
              </p>
            )}
            {syncState.lastError && (
              <p className="text-2xs text-destructive-ink mt-0.5">Błąd połączenia: {syncState.lastError}</p>
            )}
          </div>
        </div>
        <Switch checked={syncState.status !== "disabled"} onCheckedChange={handleToggle} aria-label="Synchronizacja między urządzeniami" />
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
            <code className="text-lg font-mono font-bold tracking-widest">{formatCode(syncState.code)}</code>
            <Button type="button" size="sm" variant="ghost" onClick={handleCopy} aria-label="Kopiuj kod" className="h-7 px-2 coarse:h-11 coarse:px-3">
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </Button>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => setForgetOpen(true)} className="text-muted-foreground hover:text-destructive-ink gap-1.5 coarse:h-11">
            <LogOut className="w-3.5 h-3.5" /> Zapomnij i zacznij od nowa
          </Button>
          {/* Zapomnienie rozłącza to urządzenie od grupy; bez potwierdzenia łatwo to kliknąć przez pomyłkę. */}
          <AlertDialog open={forgetOpen} onOpenChange={setForgetOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Opuścić grupę synchronizacji?</AlertDialogTitle>
                <AlertDialogDescription>
                  To urządzenie przestanie się synchronizować z pozostałymi i dostanie nowy kod. Dane w tej przeglądarce zostaną.
                  Żeby wrócić do grupy, trzeba będzie ponownie wpisać kod z innego urządzenia.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Anuluj</AlertDialogCancel>
                <AlertDialogAction onClick={() => { setForgetOpen(false); handleForget(); }}>Opuść grupę</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {wasShortCodeDropped() && (
        <div role="alert" className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs space-y-2">
          <p className="font-semibold text-foreground">Synchronizacja wyłączona: kod był za krótki</p>
          <p className="text-muted-foreground">
            Kody z 8 znaków dało się odgadnąć z nazwy pokoju widocznej dla serwera sygnalizacyjnego,
            więc ich już nie przyjmujemy. Wygeneruj nowy, 12-znakowy kod i wpisz go na pozostałych urządzeniach.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => { startPairing(); toast.success("Nowy kod gotowy — wpisz go na pozostałych urządzeniach"); }}
          >
            Wygeneruj nowy kod
          </Button>
        </div>
      )}

      <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dołącz do istniejącej grupy</p>
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-center"
          onSubmit={(e) => { e.preventDefault(); handleJoin(); }}
        >
          <InputOTP
            maxLength={CODE_LENGTH}
            pattern={CODE_PATTERN}
            pasteTransformer={codeFromPaste}
            value={joinInput}
            onChange={(v) => setJoinInput(v.toUpperCase())}
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Kod z innego urządzenia"
            aria-describedby="sync-join-hint"
            containerClassName="w-full sm:w-auto"
          >
            {[0, 4, 8].map((start, g) => (
              <div key={start} className="contents">
                {g > 0 && <InputOTPSeparator />}
                <InputOTPGroup className="flex-1 min-w-0 sm:flex-none">
                  {[0, 1, 2, 3].map((i) => (
                    <InputOTPSlot key={i} index={start + i} className="flex-1 min-w-0 sm:w-9 sm:flex-none" />
                  ))}
                </InputOTPGroup>
              </div>
            ))}
          </InputOTP>
          <Button type="submit" disabled={!joinReady} className="coarse:h-11">Dołącz</Button>
        </form>
        <p id="sync-join-hint" className="text-2xs text-muted-foreground">
          12 znaków z drugiego urządzenia — możesz wkleić cały link. Starszy, 8-znakowy kod też zadziała.
        </p>
      </div>

      <SignalingServers />

      <label className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 text-xs cursor-pointer">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={legacyRoom}
          onChange={(e) => { setLegacyRoom(e.target.checked); setLegacyRoomState(e.target.checked); }}
        />
        <span className="space-y-0.5">
          <span className="block font-semibold text-foreground">Zgodność ze starszą wersją aplikacji</span>
          <span className="block text-muted-foreground">
            Włącz tylko na czas wymiany starego urządzenia. Stary pokój ma słabą nazwę, z której serwer
            sygnalizacyjny może odzyskać kod parowania — po aktualizacji wszystkich urządzeń wyłącz.
          </span>
        </span>
      </label>

      <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground space-y-2">
        <p className="font-semibold text-foreground">Jak to działa</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>Urządzenia łączą się bezpośrednio, bez chmury i konta. Publiczne serwery pomagają tylko nawiązać połączenie — treść notatek przez nie nie przechodzi.</li>
          <li>Zmiany wymieniają się, gdy oba urządzenia są online w tym samym czasie. Jeśli jedno jest offline, dogoni przy najbliższym wspólnym połączeniu.</li>
          <li>Pierwsza synchronizacja łączy notatki i Grafik zmian z obu urządzeń — nic nie jest kasowane. Ten sam dzień grafiku zmieniony na obu urządzeniach zostaje w jednej wersji.</li>
          <li>Obrazy idą osobnym kanałem: nowy obrazek trafia na drugie urządzenie, gdy oba są online przy dodaniu albo przy kolejnym połączeniu.</li>
        </ul>
      </div>
    </div>
  );
}

/**
 * Własne serwery sygnalizacyjne. Publiczne serwery `y-webrtc` to cudza
 * infrastruktura — gdy znikną, sync cicho przestanie działać. Domyślnie puste.
 */
function SignalingServers() {
  const [saved, setSaved] = useState(() => getSignalingServers());
  const [draft, setDraft] = useState(() => saved.join("\n"));
  const { valid, invalid } = parseSignalingList(draft);
  const dirty = valid.join("\n") !== saved.join("\n");

  function handleSave() {
    setSignalingServers(valid);
    setSaved(valid);
    setDraft(valid.join("\n"));
    toast.success(valid.length ? "Zapisano serwery sygnalizacyjne" : "Przywrócono domyślne serwery");
  }

  return (
    <details className="group rounded-xl border border-border/60 bg-muted/20 p-3 text-xs" open={saved.length > 0 || undefined}>
      <summary className="cursor-pointer font-semibold text-foreground select-none">
        Serwery sygnalizacyjne {saved.length > 0 ? `(własne: ${saved.length})` : "(domyślne)"}
      </summary>
      <div className="mt-3 space-y-2">
        <p className="text-muted-foreground">
          Pomagają urządzeniom się odnaleźć — treść notatek przez nie nie przechodzi. Puste pole to
          publiczne serwery Yjs. Wszystkie urządzenia w grupie muszą mieć tę samą listę.
        </p>
        <label htmlFor="signaling-servers" className="sr-only">Adresy serwerów, po jednym w linii</label>
        <textarea
          id="signaling-servers"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="wss://sygnalizacja.example.com"
          rows={3}
          spellCheck={false}
          className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-base sm:text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
        {invalid.length > 0 && (
          <p className="text-destructive-ink">
            Nie zostanie zapisane (adres musi zaczynać się od wss:// albo ws://): {invalid.join(", ")}
          </p>
        )}
        <div className="flex justify-end gap-2">
          {saved.length > 0 && (
            <Button type="button" size="sm" variant="ghost" onClick={() => setDraft("")}>Wyczyść</Button>
          )}
          <Button type="button" size="sm" onClick={handleSave} disabled={!dirty}>Zapisz serwery</Button>
        </div>
      </div>
    </details>
  );
}
