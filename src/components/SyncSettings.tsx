import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Wifi, WifiOff, Copy, Check, LogOut } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { ToggleRow } from "@/components/settings/SettingsShared";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { checkRelay, getRelayUrl, setRelayUrl, startRelay, useRelayView, validRelayUrl, type RelayView } from "@/lib/sync/relayRuntime";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";
import {
  useSyncState, type SyncState, startPairing, joinWithCode, pauseSync, resumeSync, forgetPairing, formatCode,
  getSignalingServers, setSignalingServers, parseSignalingList, wasShortCodeDropped, getLegacyRoom, setLegacyRoom,
  codeFromPaste, CODE_LENGTH, CODE_PATTERN, getDeviceName, setDeviceName,
} from "@/lib/yjsSync";

/** Jedno zdanie o tym, na którym etapie synchronizacja stoi (bez żargonu). */
function diagnosis(s: SyncState): string {
  if (s.lastError) return "Nie udało się uruchomić połączenia. Sprawdź internet i spróbuj ponownie.";
  if (s.status === "connected" && s.peerCount === 0) return "Połączono z serwerami. Drugie urządzenie jeszcze nie dołączyło — otwórz tu sam kod na nim.";
  if (s.signalingTotal > 0 && s.signalingUp === 0) return "Nie ma połączenia z serwerem łączącym urządzenia. Sprawdź internet; połączenie wznowi się samo.";
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
  const [deviceName, setDeviceNameDraft] = useState(() => getDeviceName());

  useEffect(() => {
    if (prefillCode) setJoinInput(codeFromPaste(prefillCode));
  }, [prefillCode]);

  function handleRename() {
    setDeviceName(deviceName);
    setDeviceNameDraft(getDeviceName());
    toast.success("Zapisano nazwę urządzenia");
  }

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
    toast.success("Odłączono to urządzenie");
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
            <p className="text-xs text-muted-foreground mt-0.5" role="status" aria-live="polite">{statusLabel}</p>
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

      <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Urządzenia w grupie</h3>
        {syncState.devices.length > 0 ? (
          <ul className="space-y-1 text-sm" aria-label="Połączone urządzenia">
            {syncState.devices.map((d) => (
              <li key={d.id} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-success shrink-0" aria-hidden="true" />
                {d.name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Żadne inne urządzenie nie jest teraz połączone.</p>
        )}
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => { e.preventDefault(); handleRename(); }}
        >
          <div className="flex-1 min-w-0 space-y-1">
            <label htmlFor="sync-device-name" className="text-xs text-muted-foreground">Nazwa tego urządzenia</label>
            <Input id="sync-device-name" value={deviceName} maxLength={40} onChange={(e) => setDeviceNameDraft(e.target.value)} />
          </div>
          <Button type="submit" variant="outline" className="coarse:h-11">Zapisz</Button>
        </form>
      </div>

      {syncState.code && (
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3 text-center">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dodaj urządzenie</h3>
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
            <LogOut className="w-3.5 h-3.5" /> Odłącz to urządzenie
          </Button>
          {/* Odłączenie działa tylko na tym urządzeniu; bez potwierdzenia łatwo to kliknąć przez pomyłkę. */}
          <AlertDialog open={forgetOpen} onOpenChange={setForgetOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Odłączyć to urządzenie?</AlertDialogTitle>
                <AlertDialogDescription>
                  Pozostałe urządzenia zostaną w grupie i dalej się ze sobą synchronizują. Ta przeglądarka przestanie się synchronizować
                  i dostanie nowy kod. Dane w niej zostaną. Żeby wrócić, trzeba wpisać kod z innego urządzenia.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Anuluj</AlertDialogCancel>
                <AlertDialogAction className={buttonVariants({ variant: "destructive" })} onClick={() => { setForgetOpen(false); handleForget(); }}>Odłącz</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {wasShortCodeDropped() && (
        <div role="alert" className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs space-y-2">
          <h3 className="font-semibold text-foreground">Synchronizacja wyłączona: kod był za krótki</h3>
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
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dołącz do istniejącej grupy</h3>
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
          12 znaków z drugiego urządzenia — możesz wkleić cały link. Starszy, 8-znakowy kod już nie zadziała — wygeneruj nowy.
        </p>
      </div>

      <SignalingServers />

      <RelayServer />

      <ToggleRow
        label="Zgodność ze starszą wersją aplikacji"
        desc="Włącz tylko na czas wymiany starego urządzenia. Stary pokój ma słabą nazwę, z której serwer sygnalizacyjny może odzyskać kod parowania — po aktualizacji wszystkich urządzeń wyłącz."
        checked={legacyRoom}
        onCheck={(on) => { setLegacyRoom(on); setLegacyRoomState(on); }}
      />

      <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground space-y-2">
        <h3 className="font-semibold text-foreground">Jak to działa</h3>
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
 * Przekaźnik E2E (opcjonalny): zmiany docierają także wtedy, gdy drugie urządzenie jest wyłączone.
 * Serwer widzi tylko zaszyfrowane wpisy — patrz `relay-server/README.md`.
 */
function RelayServer() {
  const sync = useSyncState();
  const view = useRelayView();
  const [saved, setSaved] = useState(() => getRelayUrl());
  const [draft, setDraft] = useState(() => saved);
  const valid = validRelayUrl(draft);
  // Pusty pole znaczy „wyłącz”; niepoprawny adres nie da się zapisać.
  const nextUrl = draft.trim() === "" ? "" : valid;
  const [probe, setProbe] = useState<string | null>(null);

  async function handleTest() {
    const target = valid ?? saved;
    if (!target) return;
    setProbe("Sprawdzam…");
    const r = await checkRelay(target);
    setProbe(r.ok ? `Przekaźnik odpowiada (pokoi: ${r.rooms}).` : r.reason);
  }

  function handleSave() {
    setRelayUrl(draft);
    const url = getRelayUrl();
    setSaved(url);
    setDraft(url);
    // Zmiana adresu działa od razu, jeśli synchronizacja już trwa.
    if (sync.status !== "disabled" && sync.code) void startRelay(sync.code);
    toast.success(url ? "Zapisano przekaźnik" : "Wyłączono przekaźnik");
  }

  return (
    <details className="group rounded-xl border border-border/60 bg-muted/20 p-3 text-xs" open={saved !== "" || undefined}>
      <summary className="cursor-pointer font-semibold text-foreground select-none">
        Przekaźnik {saved ? "(włączony)" : "(wyłączony)"}
      </summary>
      <div className="mt-3 space-y-2">
        <p className="text-muted-foreground">
          Zmiany dochodzą nawet wtedy, gdy drugie urządzenie jest wyłączone. Serwer przechowuje
          zaszyfrowany zapis i nie zna treści ani kodu synchronizacji. Pusty adres = tylko połączenie
          bezpośrednie między urządzeniami.
        </p>
        <label htmlFor="relay-url" className="sr-only">Adres przekaźnika</label>
        <Input
          id="relay-url"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="https://sync.example.com"
          spellCheck={false}
          inputMode="url"
          className="font-mono text-base sm:text-xs"
        />
        {draft.trim() !== "" && !valid && (
          <p className="text-destructive-ink">Adres musi zaczynać się od https:// (albo http://localhost).</p>
        )}
        <p className="flex items-start gap-2 text-foreground" aria-live="polite">
          <span aria-hidden className={`mt-1 inline-block size-2 shrink-0 rounded-full ${relayDotClass(view.status, sync.status)}`} />
          <span>{relayStatusText(view, sync.status)}</span>
        </p>
        {probe && <p className="text-muted-foreground" aria-live="polite">{probe}</p>}
        <div className="flex justify-end gap-2">
          {saved && <Button type="button" size="sm" variant="ghost" onClick={() => setDraft("")}>Wyczyść</Button>}
          <Button type="button" size="sm" variant="outline" onClick={handleTest} disabled={!(valid ?? saved)}>Testuj</Button>
          <Button type="button" size="sm" onClick={handleSave} disabled={nextUrl === null || nextUrl === saved}>
            Zapisz przekaźnik
          </Button>
        </div>
      </div>
    </details>
  );
}

/** Kropka przy statusie: kolor niesie stan wizualnie, tekst obok mówi to samo dla czytnika. */
function relayDotClass(status: RelayView["status"], syncStatus: string): string {
  if (!getRelayUrl() || syncStatus === "disabled") return "bg-muted-foreground/40";
  switch (status) {
    case "online":
      return "bg-success";
    case "connecting":
      return "bg-muted-foreground motion-safe:animate-pulse";
    case "offline":
      return "bg-warning";
    case "error":
      return "bg-destructive";
    default:
      return "bg-muted-foreground/40";
  }
}

function relayStatusText(view: RelayView, syncStatus: string): string {
  if (!getRelayUrl()) return "Wyłączony.";
  if (syncStatus === "disabled") return "Synchronizacja jest wyłączona — przekaźnik wystartuje razem z nią.";
  switch (view.status) {
    case "online":
      return view.syncedAt ? `Połączono. Ostatnio zsynchronizowano ${formatDistanceToNow(view.syncedAt, { addSuffix: true, locale: pl })}.` : "Połączono.";
    case "connecting":
      return "Łączenie z przekaźnikiem…";
    case "offline":
      return "Brak połączenia z przekaźnikiem. Ponowię samo, gdy sieć wróci.";
    case "error":
      return view.detail ?? "Przekaźnik zgłasza błąd.";
    default:
      return "Czeka na start.";
  }
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
    toast.success(valid.length ? "Zapisano serwery łączące urządzenia" : "Przywrócono domyślne serwery");
  }

  return (
    <details className="group rounded-xl border border-border/60 bg-muted/20 p-3 text-xs" open={saved.length > 0 || undefined}>
      <summary className="cursor-pointer font-semibold text-foreground select-none">
        Serwery łączące urządzenia {saved.length > 0 ? `(własne: ${saved.length})` : "(domyślne)"}
      </summary>
      <div className="mt-3 space-y-2">
        <p className="text-muted-foreground">
          Pomagają urządzeniom się odnaleźć — treść notatek przez nie nie przechodzi. Puste pole to
          publiczne serwery Yjs. Wszystkie urządzenia w grupie muszą mieć tę samą listę.
        </p>
        <p className="text-foreground">
          Uwaga: zmiana tylko na jednym urządzeniu może je odłączyć od grupy — tam, gdzie lista się nie zgadza, urządzenia się nie znajdą. Zmień listę na wszystkich urządzeniach tak samo, zanim wrócisz do synchronizacji.
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
