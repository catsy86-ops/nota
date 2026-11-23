import { olderDevices } from "@/lib/formatSchema";
import { pairLink, pairTextIsV3 } from "@/lib/pairLink";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { lazy, Suspense } from "react";
const QrScanDialog = lazy(() => import("@/components/sync/QrScanDialog").then((m) => ({ default: m.QrScanDialog })));
import { Wifi, WifiOff, Copy, Check, LogOut, Eye, EyeOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ToggleRow } from "@/components/settings/SettingsShared";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { GroupedCode, JOIN_CODE_INPUT_ID, JoinCodeField } from "@/components/sync/JoinCodeField";
import { NewCodeCard, PeerPausedCard, RekeyedCard, V2OnlyNotices } from "@/components/sync/SyncCodeNotices";
import { CodeChangePanel } from "@/components/sync/CodeChangePanel";
import { DeviceRegistryList } from "@/components/sync/DeviceRegistryList";
import { useRekeyRecord } from "@/lib/sync/rekeyRuntime";
import { legacyEndsAt, readLegacyIdle } from "@/lib/legacyRoomIdle";
import { toast } from "sonner";
import { acknowledgeRelayWarning, checkRelay, deleteRelayRoom, getRelayUrl, setRelayUrl, useRelayView, validRelayUrl, type RelayView } from "@/lib/sync/relayRuntime";
import { format, formatDistanceToNow } from "date-fns";
import { syncErrorText } from "@/lib/syncErrorText";
import { relayErrorHint } from "@/lib/sync/relayErrorHint";
import { seenOffline, useSeenDevices } from "@/lib/syncSeen";
import { pl } from "date-fns/locale";
import {
  useSyncState, type SyncState, startPairing, joinWithCode, pauseSync, resumeSync, forgetPairing,
  getSignalingServers, setSignalingServers, parseSignalingList, wasShortCodeDropped, getLegacyRoom, setLegacyRoom, expireLegacyRoomIfIdle,
  codeFromPaste, codeKind, parseCode, CODE_LENGTH, getDeviceName, setDeviceName, groupIsV3Only, useNewCodeProposal, restartRelay,
} from "@/lib/yjsSync";
import { cardVariant } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Jedno zdanie o tym, na którym etapie synchronizacja stoi (bez żargonu). */
function diagnosis(s: SyncState): string {
  if (s.lastError) return syncErrorText(s.lastError);
  if (s.status === "connected" && s.peerCount === 0) return "Połączono z serwerami. Drugie urządzenie jeszcze nie dołączyło — otwórz tu sam kod na nim.";
  if (s.signalingTotal > 0 && s.signalingUp === 0) return "Nie ma połączenia z serwerem łączącym urządzenia. Sprawdź internet; połączenie wznowi się samo.";
  if (s.status === "connecting") return `Łączenie z serwerami (${s.signalingUp} z ${s.signalingTotal || "?"}).`;
  return "";
}

interface Props {
  prefillCode?: string;
  /** Link parowania miał `v=3` — grupa nie ma pokoju v2. */
  prefillV3?: boolean;
}

/** Polish plural of "urządzenie" (device) for a count — e.g. 1 urządzenie, 2 urządzenia, 5 urządzeń. */
function deviceWord(n: number): string {
  if (n === 1) return "urządzenie";
  const lastDigit = n % 10;
  const lastTwo = n % 100;
  if (lastDigit >= 2 && lastDigit <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return "urządzenia";
  return "urządzeń";
}

export function SyncSettings({ prefillCode, prefillV3 }: Props) {
  const syncState = useSyncState();
  const proposal = useNewCodeProposal();
  const rekeyRecord = useRekeyRecord();
  const seen = useSeenDevices();
  const offline = seenOffline(seen, syncState.devices.map((d) => d.name));
  const [joinInput, setJoinInput] = useState("");
  const [joinLong, setJoinLong] = useState(false);
  // Kod, do którego odnosi się `v=3` z linku/skanu/wklejenia; ręczna zmiana kodu go unieważnia.
  const [v3For, setV3For] = useState<string | null>(null);
  const [shortOpen, setShortOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  // Z-16.1B: dołączenie z wymianą danych tego urządzenia na dane grupy (po przywróceniu całego dokumentu na innym).
  const [replaceLocal, setReplaceLocal] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [copied, setCopied] = useState(false);
  // S1.5(b): kod i QR dają cały dokument, więc nie wiszą na ekranie bez potrzeby (podgląd przez ramię, zrzut, udostępnianie ekranu).
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    if (!revealed) return;
    const hide = () => setRevealed(false);
    const timer = window.setTimeout(hide, 60_000);
    const onVisibility = () => { if (document.visibilityState === "hidden") hide(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { window.clearTimeout(timer); document.removeEventListener("visibilitychange", onVisibility); };
  }, [revealed]);
  const [forgetOpen, setForgetOpen] = useState(false);
  const [legacyRoom, setLegacyRoomState] = useState(() => getLegacyRoom());
  // U-3: po 30 dniach bez urządzeń w starym pokoju przełącznik sam się wyłącza, z komunikatem.
  useEffect(() => {
    if (expireLegacyRoomIfIdle()) {
      setLegacyRoomState(false);
      toast.info("Zgodność ze starszą wersją wyłączona", { description: "Przez 30 dni żadne urządzenie nie łączyło się w starym pokoju." });
    }
  }, []);
  const [deviceName, setDeviceNameDraft] = useState(() => getDeviceName());

  /** Kod z linku, skanu albo wklejenia: pole przełącza się na długi kod, `v=3` zostaje przy tym kodzie. */
  function fillJoin(code: string, v3: boolean) {
    setJoinInput(code);
    setJoinLong(code.length > CODE_LENGTH);
    setV3For(v3 ? code : null);
  }

  useEffect(() => {
    if (prefillCode) fillJoin(codeFromPaste(prefillCode), prefillV3 === true);
  }, [prefillCode, prefillV3]);

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

  const joinCode = parseCode(joinInput).code;
  const joinReady = !!joinCode;

  function handleJoin() {
    if (!joinCode) return;
    if (replaceLocal) { setConfirmReplace(true); return; }
    if (!joinWithCode(joinCode, { v3: v3For === joinCode })) return;
    setV3For(null);
    toast.success("Dołączono do grupy synchronizacji");
  }

  async function joinReplacing() {
    if (!joinCode) return;
    setReplacing(true);
    try {
      const { requestDocReplace } = await import("@/lib/docReplace");
      await requestDocReplace({ kind: "empty", join: joinCode, v3: v3For === joinCode });
    } catch (err) {
      setReplacing(false);
      setConfirmReplace(false);
      toast.error("Nie zaczęto wymiany danych" + (err instanceof Error ? `: ${err.message}` : "") + ". Dane są bez zmian.");
    }
  }

  function focusJoin() {
    const el = document.getElementById(JOIN_CODE_INPUT_ID);
    el?.scrollIntoView({ block: "center" });
    el?.focus();
  }

  /** „Kod do przepisania ręcznie” (S2.2): krótki kod zastępuje obecny. */
  function handleShortCode() {
    startPairing("short");
    toast.success("Nowy krótki kod gotowy — wpisz go na pozostałych urządzeniach");
  }

  function handleForget() {
    forgetPairing();
    setJoinInput("");
    toast.success("Odłączono to urządzenie");
  }

  /** Odłącza i kasuje dane grupy z przekaźnika (dla wszystkich urządzeń). Kod jest potrzebny, więc kasujemy przed odłączeniem. */
  async function handleForgetAndDelete() {
    const code = syncState.code;
    const gone = code ? await deleteRelayRoom(code) : false;
    handleForget();
    if (gone) toast.success("Dane grupy usunięte z przekaźnika");
    else toast.error("Nie udało się usunąć danych z przekaźnika", { description: "Wygasną same po 180 dniach bez zapisu." });
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
    ? pairLink(window.location.origin, window.location.pathname, syncState.code, groupIsV3Only())
    : "";
  const codeIsLong = !!syncState.code && codeKind(syncState.code) === "long";
  const legacyIdle = legacyRoom ? readLegacyIdle() : null;

  const statusLabel =
    syncState.status === "rekeyed"
      ? "Wstrzymana — kod zmieniono na innym urządzeniu"
      : syncState.status === "connected" && syncState.peerCount > 0
      ? `Połączono — ${syncState.peerCount} ${deviceWord(syncState.peerCount)}`
      : syncState.status === "connected" || syncState.status === "connecting"
        ? "Aktywna — szukanie urządzeń…"
        : "Wyłączona";

  return (
    <div className="space-y-4">
      <div className={cn(cardVariant("inset"), "flex items-center justify-between gap-4 px-4 py-3")}>
        <div className="flex items-start gap-3 min-w-0">
          {syncState.status === "rekeyed" ? (
            <WifiOff className="size-5 text-warning-ink shrink-0 mt-0.5" />
          ) : syncState.status !== "disabled" ? (
            <Wifi className="size-5 text-primary-ink shrink-0 mt-0.5" />
          ) : (
            <WifiOff className="size-5 text-muted-foreground shrink-0 mt-0.5" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold">Synchronizacja między urządzeniami</p>
            <p className="ui-hint mt-0.5" role="status" aria-live="polite">{statusLabel}</p>
            {syncState.status !== "disabled" && syncState.status !== "rekeyed" && (
              <p className="ui-hint mt-1" data-testid="sync-diagnosis">{diagnosis(syncState)}</p>
            )}
            {syncState.status !== "disabled" && syncState.status !== "rekeyed" && (
              <p className="text-2xs text-muted-foreground mt-0.5">
                {syncState.lastSyncedAt
                  ? `Ostatnia zmiana z innego urządzenia: ${formatDistanceToNow(syncState.lastSyncedAt, { addSuffix: true, locale: pl })}`
                  : "W tej sesji nie przyszła jeszcze żadna zmiana z innego urządzenia"}
              </p>
            )}
            {syncState.lastError && (
              // 5.6: zdanie z radą jest wyżej (diagnoza); surowy komunikat tylko dla zgłoszenia błędu.
              <details className="mt-0.5 text-2xs text-muted-foreground">
                <summary className="cursor-pointer text-destructive-ink">Szczegóły błędu</summary>
                <code className="mt-0.5 block break-all font-mono">{syncState.lastError}</code>
              </details>
            )}
          </div>
        </div>
        <Switch checked={syncState.status !== "disabled"} onCheckedChange={handleToggle} aria-label="Synchronizacja między urządzeniami" />
      </div>

      {syncState.status === "rekeyed" && <RekeyedCard onPairAgain={focusJoin} />}
      {syncState.status !== "rekeyed" && proposal.kind && <NewCodeCard kind={proposal.kind} />}
      {syncState.status !== "disabled" && syncState.status !== "rekeyed" && syncState.p2pPausedUntil > 0 && (
        <PeerPausedCard until={syncState.p2pPausedUntil} pausesToday={syncState.p2pPausesToday} />
      )}

      <div className={cn(cardVariant("inset"), "p-4 space-y-3")}>
        <h3 className="section-caps">Urządzenia w grupie</h3>
        <V2OnlyNotices />
        {olderDevices(syncState.devices).length > 0 && (
          <p role="status" className="rounded-control border border-warning/50 bg-warning/10 px-3 py-2 text-xs text-foreground">
            {olderDevices(syncState.devices).map((d) => d.name).join(", ")} ma starszą wersję aplikacji — część danych może być na nim niewidoczna. Zaktualizuj go.
          </p>
        )}
        {syncState.devices.length > 0 ? (
          <ul className="space-y-1 text-sm" aria-label="Połączone urządzenia">
            {syncState.devices.map((d) => (
              <li key={d.id} className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-success shrink-0" aria-hidden="true" />
                {d.name}
                {d.version && <span className="text-xs text-muted-foreground">· wersja {d.version}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="ui-hint">Żadne inne urządzenie nie jest teraz połączone.</p>
        )}
        {offline.length > 0 && (
          <div data-testid="sync-seen">
            <p className="ui-hint">Ostatnio widziane</p>
            <ul className="mt-1 space-y-1 text-sm" aria-label="Ostatnio widziane urządzenia">
              {offline.slice(0, 6).map((d) => (
                <li key={d.name} className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-muted-foreground/40 shrink-0" aria-hidden="true" />
                  {d.name}
                  <span className="text-xs text-muted-foreground">· {formatDistanceToNow(d.at, { addSuffix: true, locale: pl })}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <DeviceRegistryList />
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
        <div className={cn(cardVariant("inset"), "p-4 space-y-3 text-center")}>
          <h3 className="section-caps">Dodaj urządzenie</h3>
          <p className="ui-hint">
            Zeskanuj kod aparatem na drugim urządzeniu albo wpisz go ręcznie poniżej.
            {codeIsLong && " Oba urządzenia muszą mieć aktualną wersję aplikacji."}
          </p>
          {revealed ? (
            <>
              <div className="flex justify-center">
                <div className="bg-white p-2 rounded-field">
                  <QRCodeSVG value={pairUrl} size={140} title="Kod QR do sparowania urządzenia" />
                </div>
              </div>
              <div className="flex items-center justify-center gap-2">
                <GroupedCode code={syncState.code} />
                <Button type="button" size="sm" variant="ghost" onClick={handleCopy} aria-label="Kopiuj kod" className="h-7 px-2 coarse:h-11 coarse:px-3">
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                </Button>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setRevealed(false)} className="text-muted-foreground gap-1.5 coarse:h-11">
                <EyeOff className="size-3.5" /> Ukryj kod
              </Button>
              <p className="ui-hint">Kod ukryje się sam po minucie.</p>
            </>
          ) : (
            <Button type="button" variant="outline" onClick={() => setRevealed(true)} className="gap-1.5 coarse:h-11">
              <Eye className="size-4" /> Pokaż kod i QR
            </Button>
          )}
          <div className="flex flex-wrap justify-center gap-x-2">
            {codeIsLong && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setShortOpen(true)} className="text-muted-foreground coarse:h-11">
                Kod do przepisania ręcznie
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={() => setForgetOpen(true)} className="text-muted-foreground hover:text-destructive-ink gap-1.5 coarse:h-11">
              <LogOut className="size-3.5" /> Odłącz to urządzenie
            </Button>
          </div>
          <AlertDialog open={shortOpen} onOpenChange={setShortOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Utworzyć krótki kod?</AlertDialogTitle>
                <AlertDialogDescription>
                  Krótki kod łatwiej przepisać, ale słabiej chroni przed zgadywaniem przez operatora serwera pośredniczącego.
                  Jeśli możesz, zeskanuj kod QR. Krótki kod zastąpi obecny — urządzenia, które już go użyły, trzeba będzie sparować ponownie.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Anuluj</AlertDialogCancel>
                <AlertDialogAction onClick={() => { setShortOpen(false); handleShortCode(); }}>Utwórz krótki kod</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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
                {getRelayUrl() && (
                  <AlertDialogAction className={buttonVariants({ variant: "outline" })} onClick={() => { setForgetOpen(false); void handleForgetAndDelete(); }} data-testid="forget-and-delete-relay">
                    Odłącz i usuń z przekaźnika (wszystkie urządzenia)
                  </AlertDialogAction>
                )}
                <AlertDialogAction className={buttonVariants({ variant: "destructive" })} onClick={() => { setForgetOpen(false); handleForget(); }}>Odłącz</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* Wymiana kodu (Z-15.3): przy działającej grupie albo gdy wymiana już trwa (także w kroku po przełączeniu). */}
      {((syncState.code && syncState.status !== "rekeyed") || rekeyRecord) && <CodeChangePanel />}

      {wasShortCodeDropped() && (
        <div role="alert" className={cn(cardVariant("status", "warning"), "bg-warning/10 p-3 text-xs space-y-2")}>
          <h3 className="font-semibold text-foreground">Synchronizacja wyłączona: kod był za krótki</h3>
          <p className="text-muted-foreground">
            Kody z 8 znaków dało się odgadnąć z nazwy pokoju widocznej dla serwera sygnalizacyjnego,
            więc ich już nie przyjmujemy. Wygeneruj nowy kod i zeskanuj go albo wpisz na pozostałych urządzeniach.
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

      <div className={cn(cardVariant("inset"), "p-4 space-y-2")}>
        <h3 className="section-caps">Dołącz do istniejącej grupy</h3>
        <Suspense fallback={null}>
          {scanOpen && <QrScanDialog open={scanOpen} onOpenChange={setScanOpen} onCode={(c, raw) => { fillJoin(c, pairTextIsV3(raw)); toast.success("Kod odczytany — kliknij Dołącz"); }} />}
        </Suspense>
        <form
          className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"
          onSubmit={(e) => { e.preventDefault(); handleJoin(); }}
        >
          <JoinCodeField
            value={joinInput}
            long={joinLong}
            onChange={(code, long) => { setJoinInput(code); setJoinLong(long); }}
            onPasteText={(text) => { const code = codeFromPaste(text); setV3For(pairTextIsV3(text) ? code : null); }}
          />
          <Button type="button" variant="outline" onClick={() => setScanOpen(true)} className="coarse:h-11">Zeskanuj kod</Button>
          <Button type="submit" disabled={!joinReady} className="coarse:h-11">Dołącz</Button>
        </form>
        <label className="flex items-start gap-2 text-xs">
          <Checkbox className="mt-0.5" checked={replaceLocal} onCheckedChange={(v) => setReplaceLocal(v === true)} />
          <span>
            Zastąp dane na tym urządzeniu danymi grupy
            <span className="block text-2xs text-muted-foreground">Gdy na innym urządzeniu przywrócono cały dokument z kopii. Bez tego dane tego urządzenia scalą się z grupą i cofną przywrócenie.</span>
          </span>
        </label>
        <AlertDialog open={confirmReplace} onOpenChange={(o) => { if (!replacing) setConfirmReplace(o); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Zastąpić dane na tym urządzeniu?</AlertDialogTitle>
              <AlertDialogDescription>
                Wszystkie dane w aplikacji na tym urządzeniu zostaną usunięte i zastąpione danymi grupy (zostanie ich kopia na 30 dni w Ustawieniach → Kopia i dane). Aplikacja przeładuje się, także w innych otwartych kartach.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={replacing}>Anuluj</AlertDialogCancel>
              <AlertDialogAction disabled={replacing} onClick={(e) => { e.preventDefault(); void joinReplacing(); }}>
                {replacing ? "Zapisuję kopię obecnych danych…" : "Zastąp i dołącz"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <p id="sync-join-hint" className="text-2xs text-muted-foreground">
          Kod z drugiego urządzenia (12 albo 28 znaków) — możesz wkleić cały link. Starszy, 8-znakowy kod już nie zadziała — wygeneruj nowy.{" "}
          <button
            type="button"
            className="underline underline-offset-2 hover:text-foreground"
            onClick={() => { setJoinLong(!joinLong); setJoinInput(""); setV3For(null); }}
          >
            {joinLong ? "Mam kod 12-znakowy" : "Mam kod 28-znakowy"}
          </button>
        </p>
      </div>

      <SignalingServers />

      <RelayServer />

      {/* Kod długi nigdy nie dołącza do starego pokoju — starsza wersja go nie przyjmie (S2.2). */}
      {!codeIsLong && (
        <div className="space-y-1">
          <ToggleRow
            label="Zgodność ze starszą wersją aplikacji"
            desc="Włącz tylko na czas wymiany starego urządzenia. Stary pokój ma słabą nazwę, z której serwer sygnalizacyjny może odzyskać kod parowania — po aktualizacji wszystkich urządzeń wyłącz."
            checked={legacyRoom}
            onCheck={(on) => { setLegacyRoom(on); setLegacyRoomState(on); }}
          />
          {legacyIdle && (
            <p className="px-1 text-2xs text-muted-foreground" data-testid="legacy-ends-at">
              Zgodność wyłączy się {format(legacyEndsAt(legacyIdle), "dd.MM")} (wcześniej, jeśli stare urządzenie nie pojawi się przez 30 dni).
            </p>
          )}
        </div>
      )}

      <div className={cn(cardVariant("inset"), "p-3 text-xs text-muted-foreground space-y-2")}>
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
    // Przez bramkę wymiany kodu: w `rekeyed` przekaźnik stoi.
    restartRelay();
    toast.success(url ? "Zapisano przekaźnik" : "Wyłączono przekaźnik");
  }

  return (
    <details className={cn(cardVariant("inset"), "disclosure group p-3 text-xs")} open={saved !== "" || undefined}>
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
        <RelayErrorAction view={view} />
        {probe && <p className="text-muted-foreground" aria-live="polite">{probe}</p>}
        {view.warning && (
          <div role="alert" className={cn(cardVariant("status", "warning"), "space-y-2 bg-warning/10 p-2 text-foreground")}>
            <p>{RELAY_WARNING_TEXT[view.warning]}</p>
            <div className="flex justify-end">
              <Button type="button" size="sm" variant="outline" onClick={() => void acknowledgeRelayWarning()}>Rozumiem</Button>
            </div>
          </div>
        )}
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

/** S2.3: ostrzeżenia o serwerze przekaźnika (`docs/plan-wiadomosci-i-cofniecia.md` §2.2). */
const RELAY_WARNING_TEXT: Record<NonNullable<RelayView["warning"]>, string> = {
  rollback:
    "Serwer pośredniczący cofnął się do starszego stanu. Twoje dane są bezpieczne na tym urządzeniu i zostały wysłane ponownie. Jeśli to nie Twój serwer albo zdarza się to znowu — zmień serwer.",
  "reset-loop":
    "Serwer pośredniczący kilka razy w ciągu doby zaczynał zapis od nowa. Twoje dane są bezpieczne na tym urządzeniu i zostały wysłane ponownie. Jeśli to się powtarza — sprawdź serwer albo zmień go.",
  split:
    "Inne urządzenie w grupie widzi na serwerze pośredniczącym inny stan niż to. Część zmian mogła tu nie dotrzeć. Twoje dane są bezpieczne na tym urządzeniu. Jeśli to nie Twój serwer albo zdarza się to znowu — zmień serwer.",
};

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
      return relayErrorHint(view.code)?.text ?? view.detail ?? "Przekaźnik zgłasza błąd.";
    default:
      return view.elsewhere ? "Synchronizuje inna karta tej przeglądarki — ta przejmie, gdy tamta się zamknie." : "Czeka na start.";
  }
}

/** Przycisk przy wskazówce błędu (ROOM_FULL → panel „Zmiana kodu”), gdy panel jest na stronie. */
function RelayErrorAction({ view }: { view: RelayView }) {
  const action = view.status === "error" ? relayErrorHint(view.code)?.action : undefined;
  if (!action) return null;
  function go() {
    const el = document.querySelector<HTMLElement>(`[data-testid="${action!.target}"]`);
    if (!el) return;
    el.scrollIntoView({ block: "start", behavior: "smooth" });
    el.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
  }
  return (
    <div className="flex justify-end">
      <Button type="button" size="sm" variant="outline" onClick={go} data-testid="relay-error-action">{action.label}</Button>
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
    toast.success(valid.length ? "Zapisano serwery łączące urządzenia" : "Przywrócono domyślne serwery");
  }

  return (
    <details className={cn(cardVariant("inset"), "disclosure group p-3 text-xs")} open={saved.length > 0 || undefined}>
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
          className="w-full rounded-control border border-input bg-background px-3 py-2 font-mono text-base sm:text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
