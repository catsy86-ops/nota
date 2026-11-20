import { useSyncExternalStore } from "react";
import { mayLeaveDevice, sizeCappedRefsIn } from "@/lib/plans/planRefs";
import { createStore, get as idbGet, set as idbSet, del as idbDel, clear as idbClear, type UseStore } from "idb-keyval";
import { yjsStore } from "@/lib/yjsStore";
import { logDiag, logSecurity } from "@/lib/diagnostics";
import { toast } from "@/lib/notify";
import { deriveRelayKeys } from "@/lib/sync/relayKeys";
import { RelayProvider, type RelayErrorCode, type RelayState, type RelayStatus, type RelayStore, type RelayWarning } from "@/lib/sync/relayProvider";
import { RelayHeadCompare, relayUrlTag, type OwnRelayHead } from "@/lib/sync/relayHeadCompare";
import { RelayBlobs } from "@/lib/sync/relayBlobs";
import { holdTabRole, RELAY_ROLE } from "@/lib/tabLock";

/**
 * Uruchamianie przekaźnika razem z synchronizacją (`yjsSync.ts` woła `startRelay`
 * w `connect()` i `stopRelay` w `disconnectProvider()`). Adres serwera jest opcjonalny:
 * bez niego nic się nie dzieje i działa samo P2P.
 */

const URL_KEY = "kaczy.relay.v1";

/** Adres przekaźnika: `https://…` albo `http://localhost…` (do testów). Inaczej `null`. */
export function validRelayUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
    if (u.protocol !== "https:" && !(u.protocol === "http:" && local)) return null;
    return s.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

export function getRelayUrl(): string {
  try {
    return localStorage.getItem(URL_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setRelayUrl(raw: string): void {
  try {
    const url = validRelayUrl(raw);
    if (url) localStorage.setItem(URL_KEY, url);
    else localStorage.removeItem(URL_KEY);
  } catch {
    // Prywatne okno bez dostępu do localStorage: ustawienie przepada, nie ma czego naprawiać.
  }
}

// ── stan dla UI ──────────────────────────────────────────────────────────────

export interface RelayView {
  status: RelayStatus;
  detail?: string;
  /** Kod trwałego błędu (np. ROOM_FULL) — do wskazówki w UI. */
  code?: RelayErrorCode;
  /** Ostatnie udane wysłanie albo pobranie (ms), do „ostatnio zsynchronizowano”. */
  syncedAt: number | null;
  /** Przekaźnik prowadzi inna karta tej przeglądarki; ta czeka na rolę. */
  elsewhere?: boolean;
  /** Ostrzeżenie o serwerze (cofnięcie, pętla resetów, rozjazd z sąsiadem) — S2.3. */
  warning?: RelayWarning | null;
}

let view: RelayView = { status: "idle", syncedAt: null };
const listeners = new Set<() => void>();

function setView(next: Partial<RelayView>) {
  view = { ...view, ...next };
  listeners.forEach((l) => l());
}

/** Sprawdza, czy pod adresem odpowiada przekaźnik (`GET /health`). Nie wymaga kodu ani tokenu. */
export async function checkRelay(url: string, timeoutMs = 5000): Promise<{ ok: true; rooms: number } | { ok: false; reason: string }> {
  const base = validRelayUrl(url);
  if (!base) return { ok: false, reason: "Zły adres" };
  try {
    const res = await fetch(`${base}/health`, { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return { ok: false, reason: `Serwer odpowiedział kodem ${res.status}` };
    const json = (await res.json()) as { ok?: unknown; rooms?: unknown };
    if (json.ok !== true) return { ok: false, reason: "To nie wygląda na przekaźnik NOTKI" };
    return { ok: true, rooms: typeof json.rooms === "number" ? json.rooms : 0 };
  } catch {
    return { ok: false, reason: "Brak odpowiedzi — sprawdź adres i sieć" };
  }
}

/**
 * Usuwa z przekaźnika cały pokój grupy (zaszyfrowane wpisy i bloby) — dla WSZYSTKICH urządzeń grupy (S13 audytu).
 * Wymaga kodu grupy (z niego wynika token pokoju). `true` = usunięto albo pokoju już nie było.
 */
export async function deleteRelayRoom(code: string, timeoutMs = 10_000): Promise<boolean> {
  const base = validRelayUrl(getRelayUrl());
  if (!base) return false;
  try {
    const keys = await deriveRelayKeys(code);
    const res = await fetch(`${base}/rooms/${keys.roomId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${keys.token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

export function getRelayView(): RelayView {
  return view;
}

export function useRelayView(): RelayView {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getRelayView,
  );
}

// ── trwały magazyn (IndexedDB) ───────────────────────────────────────────────

let relayDb: UseStore | null = null;
const db = () => (relayDb ??= createStore("kaczy-relay", "state"));

/** Magazyn kursora i kolejki jednego pokoju; wymiana kodu (krok 2) zakłada nim nowy pokój z góry. */
export function idbRelayStore(roomId: string): RelayStore {
  const pendingKey = `pending:${roomId}`;
  const stateKey = `state:${roomId}`;
  return {
    async loadPending() {
      const v = await idbGet<Uint8Array>(pendingKey, db());
      return v ?? null;
    },
    async savePending(bytes) {
      if (bytes) await idbSet(pendingKey, bytes, db());
      else await idbDel(pendingKey, db());
    },
    async loadState() {
      const v = await idbGet<RelayState>(stateKey, db());
      return v ?? { cursor: 0, compactedAt: 0 };
    },
    async saveState(state) {
      await idbSet(stateKey, state, db());
    },
  };
}

/**
 * Usuwa kursory i kolejki **wszystkich** pokoi (wymiana całego dokumentu, Z-16.1B): kolejka wysyłki ze starego
 * dokumentu po wymianie odesłałaby grupie stan, który miał zniknąć.
 */
export async function clearRelayState(): Promise<void> {
  await idbClear(db());
}

/** Usuwa lokalny kursor i kolejkę pokoju (po wymianie kodu i po dołączeniu nowym kodem po `rekeyed`). */
export async function forgetRelayRoom(roomId: string): Promise<void> {
  await Promise.all([idbDel(`pending:${roomId}`, db()), idbDel(`state:${roomId}`, db())]);
}

// ── blokada wysyłki (wymiana kodu, I-3/I-7) ────────────────────────────────────

/**
 * `yjsSync` rejestruje tu sprawdzenie „kod nie został wycofany” — bez importu w drugą stronę (`yjsSync` importuje ten
 * moduł). Brak bramki = wysyłka dozwolona. Blokada zdejmowana jest tylko przez ponowne połączenie (nowy start).
 */
let sendGate: ((code: string) => boolean) | null = null;
export function setRelayGate(gate: ((code: string) => boolean) | null): void {
  sendGate = gate;
}

// ── start / stop ─────────────────────────────────────────────────────────────

let provider: RelayProvider | null = null;
let providerUrl = "";
const headCompare = new RelayHeadCompare();
const WARNING_KINDS: Record<RelayWarning, "relay-rollback" | "relay-reset-loop" | "relay-split"> = {
  rollback: "relay-rollback",
  "reset-loop": "relay-reset-loop",
  split: "relay-split",
};

/** „Rozumiem” w ustawieniach: zdejmuje ostrzeżenie o serwerze. */
export async function acknowledgeRelayWarning(): Promise<void> {
  await provider?.acknowledgeWarning();
  setView({ warning: null });
}

/** Głowa pokoju do rozgłoszenia w awareness (`yjsSync.ts`): `{ epoch, last, u }` albo `null`. */
export function relayHeadClaim(): { epoch: string; last: number; u: string } | null {
  const head = provider?.head;
  if (!head?.epoch) return null;
  return { epoch: head.epoch, last: head.last, u: relayUrlTag(providerUrl) };
}

const headListeners = new Set<() => void>();
/** Powiadamia o nowej głowie pokoju po pobraniu (do odświeżenia awareness). */
export function onRelayHead(cb: () => void): () => void {
  headListeners.add(cb);
  return () => headListeners.delete(cb);
}

/**
 * Porównanie z głowami sąsiadów (§2.3). `states` — stany awareness bez własnego; wołane przy każdej aktualizacji
 * awareness (odnawiana co 15 s, więc rozjazd trwający ponad minutę zostanie zauważony).
 */
export function compareRelayHeads(states: Map<number, unknown>, now = Date.now()): void {
  const p = provider;
  const head = p?.head;
  const own: OwnRelayHead | null = head ? { ...head, u: relayUrlTag(providerUrl) } : null;
  headCompare.retain(states.keys());
  for (const [id, s] of states) {
    const claim = (s as { relay?: unknown } | null)?.relay;
    if (headCompare.observe(id, claim, own, now) && p) {
      void p.raiseWarning("split", `sąsiad: ${String((claim as { last?: unknown }).last)}, tu: ${own?.last}`).then(() => setView({ warning: p.warning }));
    }
  }
}
// Bloby (obrazy, załączniki): przebieg po zmianach notatek, z opóźnieniem, jeden naraz.
let blobs: RelayBlobs | null = null;
let blobTimer: ReturnType<typeof setTimeout> | null = null;
let blobRunning = false;
let blobRerun = false;
let unobserveNotes: (() => void) | null = null;

function scheduleBlobs(delayMs = 3000): void {
  if (!blobs) return;
  if (blobTimer) clearTimeout(blobTimer);
  blobTimer = setTimeout(runBlobs, delayMs);
}

async function runBlobs(): Promise<void> {
  blobTimer = null;
  const current = blobs;
  if (!current) return;
  if (blobRunning) {
    blobRerun = true;
    return;
  }
  blobRunning = true;
  try {
    const r = await current.sync();
    if (r.failed > 0) logDiag("warn", "relay", `bloby: ${r.failed} nieudanych przebiegów`);
  } catch (err) {
    logDiag("warn", "relay", "przebieg blobów nieudany", err);
  } finally {
    blobRunning = false;
    if (blobRerun && blobs) {
      blobRerun = false;
      scheduleBlobs(0);
    }
  }
}
const REMOTE_TOAST_GAP_MS = 30_000;
let lastRemoteToastAt = 0;
let startToken = 0;
let onVisibility: (() => void) | null = null;
let onOnline: (() => void) | null = null;
let releaseRole: (() => void) | null = null;

/**
 * W4: pierwsze pobranie z przekaźnika po starcie. WebRTC czeka na nie (`relayFirstPull`), żeby urządzenie wracające po
 * wymianie kodu zobaczyło znacznik z przekaźnika, zanim wyśle zaległe zmiany bezpośrednio do urządzeń w starym pokoju.
 * Kończy je pierwszy stan inny niż `connecting` (pobranie idzie w łańcuchu przed wysyłką), rola u innej karty, stop
 * albo brak adresu przekaźnika.
 */
let firstPullDone = true;
let firstPullWaiters: (() => void)[] = [];
const FIRST_PULL_WAIT_MS = 15_000;

function finishFirstPull(): void {
  firstPullDone = true;
  const waiters = firstPullWaiters;
  firstPullWaiters = [];
  waiters.forEach((w) => w());
}

/** Czeka na pierwsze pobranie z przekaźnika, najwyżej `timeoutMs` (wolny albo niedostępny serwer nie blokuje WebRTC). */
export function relayFirstPull(timeoutMs = FIRST_PULL_WAIT_MS): Promise<void> {
  if (firstPullDone) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => { clearTimeout(timer); resolve(); };
    const timer = setTimeout(() => {
      firstPullWaiters = firstPullWaiters.filter((w) => w !== done);
      logDiag("warn", "relay", "pierwsze pobranie trwa zbyt długo — WebRTC startuje bez niego");
      resolve();
    }, timeoutMs);
    firstPullWaiters.push(done);
  });
}

/**
 * Przy kilku kartach przekaźnik prowadzi jedna (Z-7): kursor i kolejka wysyłki leżą w jednej bazie,
 * więc dwie karty nadpisywałyby je sobie nawzajem. Pozostałe czekają na rolę; ich zmiany idą do
 * prowadzącej przez `tabSync` i stamtąd na serwer, a zmiany z serwera wracają tą samą drogą.
 * Po zamknięciu prowadzącej rolę dostaje następna i startuje od zapisanego kursora.
 */
export async function startRelay(code: string): Promise<void> {
  stopRelay();
  const url = validRelayUrl(getRelayUrl());
  if (!url) return;
  const token = ++startToken;
  firstPullDone = false;
  setView({ status: "connecting", detail: undefined, code: undefined });
  releaseRole = holdTabRole(
    RELAY_ROLE,
    () => { void lead(code, url, token); },
    () => {
      if (token !== startToken) return;
      // Przekaźnik prowadzi inna karta i to ona pobiera; ta nie ma na co czekać.
      finishFirstPull();
      setView({ status: "idle", detail: undefined, code: undefined, elsewhere: true });
    },
  );
}

async function lead(code: string, url: string, token: number): Promise<void> {
  if (token !== startToken) return;
  setView({ status: "connecting", detail: undefined, code: undefined, elsewhere: false });
  try {
    const keys = await deriveRelayKeys(code);
    if (token !== startToken) return; // zastąpione przez późniejszy start albo stop
    const p = new RelayProvider({
      baseUrl: url,
      keys,
      doc: yjsStore.doc,
      store: idbRelayStore(keys.roomId),
      canSend: () => !sendGate || sendGate(code),
      onWarning: (kind, detail) => {
        logSecurity(WARNING_KINDS[kind], detail);
        logDiag("warn", "relay", `ostrzeżenie ${kind}: ${detail}`);
      },
      onHead: () => {
        if (token === startToken) setView({ warning: p.warning });
        headListeners.forEach((l) => l());
      },
      openSocket: (wsUrl) => new WebSocket(wsUrl),
      onRemoteChange: () => {
        scheduleBlobs(0);
        // Jak w yjsSync: tylko na widocznej karcie i co 30 s, seria zmian to jedno powiadomienie.
        const now = Date.now();
        if (document.visibilityState !== "visible" || now - lastRemoteToastAt < REMOTE_TOAST_GAP_MS) return;
        lastRemoteToastAt = now;
        toast("Zmiana z innego urządzenia", { description: "Przyszła przez przekaźnik." });
      },
      onStatus: (status, detail, code) => {
        if (token !== startToken) return;
        if (status !== "connecting") finishFirstPull();
        setView({ status, detail, code, ...(status === "online" ? { syncedAt: Date.now() } : {}) });
        if (status === "error") logDiag("error", "relay", detail ?? "błąd przekaźnika");
      },
    });
    provider = p;
    providerUrl = url;
    headCompare.reset();
    blobs = new RelayBlobs({
      baseUrl: url, keys, refs: () => yjsStore.syncableRefs(), images: yjsStore.images,
      mayUpload: (hash, size) => mayLeaveDevice(hash, size, sizeCappedRefsIn(yjsStore.doc)),
      // Przebieg trwa po `stopRelay` z przechwyconym obiektem — bez tego wysyłałby dalej po zatrzymaniu (I-3).
      canSend: () => token === startToken && (!sendGate || sendGate(code)),
    });
    const onNotes = () => scheduleBlobs();
    yjsStore.notesMap.observeDeep(onNotes);
    unobserveNotes = () => yjsStore.notesMap.unobserveDeep(onNotes);
    // Karta chowana: wysyłamy od razu, zanim system zamrozi stronę. Wracamy: nadrabiamy.
    onVisibility = () => p.setHidden(document.visibilityState === "hidden");
    onOnline = () => p.sync();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    await p.start();
    if (token === startToken) setView({ warning: p.warning });
  } catch (err) {
    if (token !== startToken) return;
    logDiag("error", "relay", "nie udało się uruchomić przekaźnika", err);
    finishFirstPull();
    setView({ status: "error", detail: "Nie udało się uruchomić przekaźnika", code: undefined });
  }
}

export function stopRelay(): void {
  startToken++;
  finishFirstPull();
  releaseRole?.();
  releaseRole = null;
  if (onVisibility) document.removeEventListener("visibilitychange", onVisibility);
  if (onOnline) window.removeEventListener("online", onOnline);
  onVisibility = null;
  onOnline = null;
  provider?.stop();
  provider = null;
  headCompare.reset();
  blobs = null;
  if (blobTimer) clearTimeout(blobTimer);
  blobTimer = null;
  blobRerun = false;
  unobserveNotes?.();
  unobserveNotes = null;
  setView({ status: "idle", detail: undefined, code: undefined, elsewhere: false, warning: null });
}
