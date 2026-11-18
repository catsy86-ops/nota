import { cleanSchemaClaim, cleanVersionClaim, localDeviceSchema, setDeviceSource, type DeviceSchema } from "@/lib/formatSchema";
import { cleanDeviceName, getSeenDevices, recordSeenDevices } from "@/lib/syncSeen";
import { clearLegacyIdle, legacyIdleExpired, markLegacyEnabled, markLegacySeen, readLegacyIdle } from "@/lib/legacyRoomIdle";
import { useSyncExternalStore } from "react";
import type { WebrtcProvider } from "y-webrtc";
import { chunkProvider } from "@/lib/sync/peerChunks";
import * as Y from "yjs";
import { yjsStore } from "@/lib/yjsStore";
import { startImageSync, stopImageSync } from "@/lib/imageSync";
import { compareRelayHeads, forgetRelayRoom, onRelayHead, relayHeadClaim, setRelayGate, startRelay, stopRelay } from "@/lib/sync/relayRuntime";
import { deriveRelayKeys } from "@/lib/sync/relayKeys";
import { codeKind, generateCode, parseCode, type CodeKind } from "@/lib/sync/pairCode";
import {
  V2_COMPAT_MS, V2_ONLY_GRACE_MS, clearAllV2Only, clearV2Only, extendV2Window, getV2Only, latestV2Only, recordV2Only,
} from "@/lib/sync/v2Window";
import {
  REKEY_LOCK, REKEY_STORAGE_KEY, SYNC_CONTROL_MAP, cancelRekey, pruneMarkers, prepareRekey, readMarkers, rekeyTag, runRekey, stoppingMarker,
  rekeyFinished, withDevicePaired, type RekeyRecord, type RekeyResult, type RunOptions,
} from "@/lib/sync/rekey";
import { loadRekeyRecord, notifyRekeyRecord, rekeyPorts, saveRekeyRecord } from "@/lib/sync/rekeyRuntime";
import { logDiag } from "@/lib/diagnostics";
import { toast } from "@/lib/notify";

/**
 * Peer-to-peer transport for the Yjs doc (Phase 2 of the multi-device sync
 * project — see roadmap.md). Opt-in: disabled by default, no account, no
 * backend of our own. Pairing works through a short human-typable code that
 * doubles as the WebRTC signaling password; the room name is a hash of that
 * code so the (public, third-party) signaling servers never see it verbatim.
 *
 * Images sync too, but through a separate transport — see imageSync.ts,
 * started/stopped alongside this provider in connect()/disconnectProvider().
 */

const STORAGE_KEY = "kaczy.sync.v1";
// Format kodu (krótki 12 / długi 28 znaków) i okno pokoju v2 mają własne moduły; tu zostają nazwy dla starszych importów.
export {
  CODE_ALPHABET, CODE_LENGTH, CODE_LENGTH_LONG, CODE_PATTERN, codeErrorText, codeFromPaste, codeKind, formatCode, generateCode,
  normalizeCode, parseCode, type CodeKind,
} from "@/lib/sync/pairCode";
export { V2_COMPAT_MS } from "@/lib/sync/v2Window";
/**
 * Zgodność ze starszą wersją aplikacji (opt-in, domyślnie WYŁĄCZONA).
 * Starsza wersja zna tylko pokój o nazwie FNV-64 z kodu. Taka nazwa idzie
 * jawnie do publicznych serwerów sygnalizacyjnych, a FNV nie jest funkcją
 * jednokierunkową (każdy krok da się odwrócić, atak meet-in-the-middle ≈ 2^30)
 * — operator serwera odzyskałby kod parowania, czyli i hasło szyfrujące ruch.
 * Dlatego urządzenie dołącza do starego pokoju tylko po jawnym włączeniu
 * (Ustawienia → Synchronizacja → Zgodność), na czas wymiany starego urządzenia.
 */
const DEFAULT_LEGACY_ROOM = false;

interface SyncPrefs {
  enabled: boolean;
  code: string | null;
  /** Własne serwery sygnalizacyjne; pusta lista = domyślne publiczne z `y-webrtc`. */
  signaling: string[];
  /** Dołącz też do starego pokoju FNV (patrz `DEFAULT_LEGACY_ROOM`). */
  legacyRoom: boolean;
  /** Zapisany kod był krótki (8 znaków) i został usunięty — trzeba sparować ponownie. */
  shortCodeDropped: boolean;
  /**
   * Do kiedy (ms) urządzenie dołącza też do pokoju v2 (SHA-256), żeby grupa ze starszymi wersjami aplikacji nie zniknęła
   * po przejściu na pokój v3 (S3). `null` = nie dołącza (nowa grupa); `undefined` = zapis sprzed tej zmiany
   * (`initSync` zamienia go na 30 dni od pierwszego uruchomienia).
   */
  v2Until?: number | null;
  /** Początek okna v2 — od niego liczy się twardy koniec 90 dni (S2.6). Brak = `v2Until − 30 dni`. */
  v2Start?: number | null;
  /** Urządzenie dołączało z obecnym kodem do pokoju v2 / najstarszego — podstawa propozycji nowego kodu (§2.3). */
  v2Exposed: boolean;
  legacyExposed: boolean;
  /** Baner propozycji na Dziś: „dismissed” = zamknięty na stałe (karta w ustawieniach zostaje). */
  newCodeHint: "open" | "dismissed";
  /** Znaczniki „kod zmieniony”, które użytkownik kazał pominąć („Synchronizuj dalej na starym kodzie”). */
  ignoredRekey: string[];
}

/** Pola związane z kodem — zmiana kodu zeruje je wszystkie. */
// `legacyRoom` też: zgodność włączona dla starego kodu nie może przejść na nowy (nazwa FNV ujawnia kod).
const freshCode = (): Pick<SyncPrefs, "v2Exposed" | "legacyExposed" | "newCodeHint" | "ignoredRekey" | "legacyRoom"> =>
  ({ v2Exposed: false, legacyExposed: false, newCodeHint: "open", ignoredRekey: [], legacyRoom: false });

/** Lokalne magazyny zależne od kodu (poza `kaczy.sync.v1`) — razem z `freshCode` przy każdej zmianie kodu. */
function clearCodeScoped(): void {
  clearAllV2Only();
  clearLegacyIdle();
}

const DEFAULT_PREFS: SyncPrefs = {
  ...freshCode(),
  enabled: false, code: null, signaling: [], legacyRoom: DEFAULT_LEGACY_ROOM, shortCodeDropped: false, v2Until: null, v2Start: null,
};
const IGNORED_REKEY_MAX = 20;

// Ostatni przeczytany tekst i wynik: bramka przekaźnika i hooki czytają ustawienia często, a parsowanie nie jest darmowe.
// Wynik jest współdzielony — wołający nie modyfikują go, tylko budują nowy obiekt do `writePrefs`.
let prefsCache: { raw: string; prefs: SyncPrefs } | null = null;

function readPrefs(): SyncPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    if (prefsCache?.raw === raw) return prefsCache.prefs;
    const prefs = parsePrefs(raw);
    prefsCache = { raw, prefs };
    return prefs;
  } catch (err) {
    logDiag("warn", "yjsSync", "unreadable sync prefs, using defaults", err);
    return DEFAULT_PREFS;
  }
}

/** Rzuca przy uszkodzonym JSON-ie — `readPrefs` łapie i wraca do ustawień domyślnych. */
function parsePrefs(raw: string): SyncPrefs {
  const stored = JSON.parse(raw) as Partial<SyncPrefs>;
  const parsed = { ...DEFAULT_PREFS, ...stored };
  // localStorage bywa uszkodzony albo podmieniony — każde pole sprawdzamy z osobna.
  const signaling = Array.isArray(parsed.signaling)
    ? parseSignalingList(parsed.signaling.filter((s: unknown) => typeof s === "string").join(" ")).valid
    : [];
  const rawCode = typeof parsed.code === "string" && /^\S{1,64}$/.test(parsed.code) ? parsed.code : null;
  // Kod, którego `parseCode` nie rozpoznaje (8 znaków ze starszej wersji, uszkodzony), jest usuwany — nazwa pokoju
  // z 8 znaków dałaby się odgadnąć; trzeba sparować ponownie.
  const code = rawCode === null ? null : parseCode(rawCode).code ?? null;
  const dropped = rawCode !== null && code === null;
  const short = code !== null && codeKind(code) === "short";
  return {
    enabled: parsed.enabled === true && code !== null, code, signaling, legacyRoom: parsed.legacyRoom === true,
    shortCodeDropped: dropped || parsed.shortCodeDropped === true,
    v2Until: typeof stored.v2Until === "number" ? stored.v2Until : stored.v2Until === null ? null : undefined,
    v2Start: typeof stored.v2Start === "number" ? stored.v2Start : null,
    // Zapis sprzed tych pól: kod krótki z otwartym (albo jeszcze nierozpoczętym) oknem v2 był w pokoju v2.
    v2Exposed: typeof stored.v2Exposed === "boolean" ? stored.v2Exposed : short && stored.v2Until !== null,
    legacyExposed: typeof stored.legacyExposed === "boolean" ? stored.legacyExposed : parsed.legacyRoom === true,
    newCodeHint: stored.newCodeHint === "dismissed" ? "dismissed" : "open",
    ignoredRekey: Array.isArray(stored.ignoredRekey)
      ? stored.ignoredRekey.filter((id): id is string => typeof id === "string" && /^[0-9a-f]{32}$/.test(id)).slice(-IGNORED_REKEY_MAX)
      : [],
  };
}

/** `false` = zapis się nie udał (prywatne okno, pełny dysk). Powiadamia hooki czytające ustawienia. */
function writePrefs(prefs: SyncPrefs): boolean {
  let ok = true;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch (err) { ok = false; logDiag("warn", "yjsSync", "cannot persist sync prefs", err); }
  emit();
  return ok;
}

/**
 * `rekeyed` — kod tej grupy został zmieniony na innym urządzeniu (znacznik w `syncControl`, §3.3): synchronizacja
 * stoi, `enabled` zostaje `true`, dane lokalne bez zmian. Wyjście: sparować nowym kodem albo „Synchronizuj dalej”.
 */
export type SyncStatus = "disabled" | "connecting" | "connected" | "rekeyed";

/** Inne urządzenie w grupie, widoczne przez awareness (nazwa z jego ustawień). */
export interface SyncDevice extends DeviceSchema {
  id: number;
  name: string;
}

export interface SyncState {
  status: SyncStatus;
  peerCount: number;
  /** Nazwy innych urządzeń połączonych teraz (z pokoju v2; patrz `refreshDevices`). */
  devices: SyncDevice[];
  code: string | null;
  /** Kiedy ostatnio przyszła zmiana od innego urządzenia (ms). Tylko w tej sesji. */
  lastSyncedAt: number | null;
  /** Ostatni błąd transportu — żeby „nie synchronizuje się” miało odpowiedź. */
  lastError: string | null;
  /** Ile serwerów sygnalizacji odpowiada z tylu, do których dołączamy (diagnostyka w ustawieniach). */
  signalingUp: number;
  signalingTotal: number;
}

const DEFAULT_STATE: SyncState = { status: "disabled", peerCount: 0, devices: [], code: null, lastSyncedAt: null, lastError: null, signalingUp: 0, signalingTotal: 0 };
// Ponowne łączenie po powrocie do karty albo odzyskaniu sieci — nie częściej niż co tyle ms.
const RECONNECT_MIN_GAP_MS = 10_000;
let lastConnectAt = 0;
const REMOTE_TOAST_GAP_MS = 30_000;
let lastRemoteToastAt = 0;
// Zmiany od peerów potrafią przychodzić seriami; odświeżamy znacznik co najwyżej
// raz na kilka sekund, żeby nie przerenderowywać Ustawień przy każdej.
const SYNCED_AT_THROTTLE_MS = 5000;

let state: SyncState = { ...DEFAULT_STATE, code: readPrefs().code };
setDeviceSource(() => state.devices);
let providers: WebrtcProvider[] = [];
// Bumped on every connect()/disconnectProvider() so a dynamic import("y-webrtc")
// still in flight from a superseded call can tell it's stale and back off.
let connectToken = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getSyncState(): SyncState {
  return state;
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(subscribe, getSyncState, () => DEFAULT_STATE);
}

/**
 * STARY pokój (okres przejściowy, patrz `JOIN_LEGACY_ROOM`): dwa 32-bitowe
 * FNV, razem 64 bity. Kolizja nazwy z obcą grupą kończyła się pokojem, w którym
 * `WebrtcProvider` nie odszyfruje ruchu i status utyka w „connecting”.
 */
export function roomNameFor(code: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x1000193 ^ code.length;
  for (let i = 0; i < code.length; i++) {
    const c = code.charCodeAt(i);
    h1 = (h1 ^ c) >>> 0;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 = (h2 ^ c) >>> 0;
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }
  return `kaczy-${h1.toString(16).padStart(8, "0")}${h2.toString(16).padStart(8, "0")}`;
}

/**
 * Nowy pokój: SHA-256 kodu (128 bitów w nazwie). Nazwa trafia do publicznych
 * serwerów sygnalizacyjnych, więc nie może zawierać samego kodu; ruch chroni
 * `password` (kod), nazwa ma tylko nie kolidować z cudzą grupą.
 */
export async function roomNameV2For(code: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`kaczy-room:${code}`));
  const hex = Array.from(new Uint8Array(digest).slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
  return `kaczy2-${hex}`;
}

/**
 * Pokój v3: nazwa z PBKDF2 (200 tys. iteracji), nie z samego SHA-256. Nazwa trafia do publicznych serwerów
 * sygnalizacyjnych, a kod (~59 bitów) jest hasłem ruchu — przy szybkim skrócie operator serwera mógłby odgadnąć kod
 * offline (rzędu godzin–dni na farmie GPU); wolny KDF przesuwa to poza zasięg (S3 audytu 2026-11-11).
 */
const ROOM_V3_ITERATIONS = 200_000;
// Obietnice, nie wyniki: bramka wymiany kodu i lista pokoi pytają równolegle — PBKDF2 liczy się raz.
const roomV3Cache = new Map<string, Promise<string>>();
export function roomNameV3For(code: string): Promise<string> {
  let p = roomV3Cache.get(code);
  if (!p) {
    p = deriveRoomV3(code);
    roomV3Cache.set(code, p);
    p.catch(() => roomV3Cache.delete(code));
  }
  return p;
}

async function deriveRoomV3(code: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(code), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode("kaczy-room-v3"), iterations: ROOM_V3_ITERATIONS }, key, 128);
  const name = `kaczy3-${Array.from(new Uint8Array(bits), (b) => b.toString(16).padStart(2, "0")).join("")}`;
  return name;
}

/**
 * Lista serwerów z pola tekstowego: po jednym w linii (albo po przecinku),
 * tylko `ws://`/`wss://`, bez duplikatów. Zwraca też odrzucone wpisy do pokazania.
 */
export function parseSignalingList(raw: string): { valid: string[]; invalid: string[] } {
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const entry of raw.split(/[\s,]+/).map((e) => e.trim()).filter(Boolean)) {
    let ok = false;
    try {
      const u = new URL(entry);
      ok = (u.protocol === "ws:" || u.protocol === "wss:") && !!u.host;
    } catch { /* nie URL */ }
    if (!ok) invalid.push(entry);
    else if (!valid.includes(entry)) valid.push(entry);
  }
  return { valid, invalid };
}

export function getSignalingServers(): string[] {
  return readPrefs().signaling;
}

/**
 * Opcje `WebrtcProvider` — **te same** dla tekstu i obrazów, inaczej trafiłyby
 * na różne serwery i rozjechały się. Pusta lista = domyślne serwery `y-webrtc`.
 */
export function providerOptions(code: string): { password: string; signaling?: string[] } {
  const { signaling } = readPrefs();
  return signaling.length ? { password: code, signaling } : { password: code };
}

/** Zapisuje listę serwerów i — jeśli sync jest włączony — łączy się od nowa. */
export function setSignalingServers(servers: string[]): void {
  const prefs = readPrefs();
  const signaling = parseSignalingList(servers.join(" ")).valid;
  writePrefs({ ...prefs, signaling });
  logDiag("info", "yjsSync", `signaling servers: ${signaling.length ? signaling.length + " custom" : "default"}`);
  if (prefs.enabled && prefs.code) connect(prefs.code);
}

/** Czy okno zgodności z pokojem v2 jeszcze trwa. */
export function v2CompatActive(now: number = Date.now()): boolean {
  const until = readPrefs().v2Until;
  return typeof until === "number" && now < until;
}

/** Koniec okna v2 (ms) albo `null`, gdy urządzenie do pokoju v2 nie dołącza. */
export function getV2Until(): number | null {
  const { code, v2Until } = readPrefs();
  return code && codeKind(code) === "short" && typeof v2Until === "number" ? v2Until : null;
}

/** Czy grupa nie ma pokoju v2 — link parowania dostaje wtedy `&v=3` (§2.2). */
export function groupIsV3Only(): boolean {
  const { code, v2Until } = readPrefs();
  return !!code && (codeKind(code) === "long" || v2Until === null);
}

/**
 * Okno minęło, a w pokoju v2 było niedawno urządzenie ze starą wersją → przedłużenie o 30 dni, najwyżej do 90 dni
 * od początku okna (§2.2). Wołane przed wyliczeniem pokoi w `connect`.
 */
function extendV2IfNeeded(now: number = Date.now()): void {
  const prefs = readPrefs();
  if (!prefs.code || codeKind(prefs.code) !== "short" || typeof prefs.v2Until !== "number") return;
  const next = extendV2Window({ v2Until: prefs.v2Until, v2Start: prefs.v2Start }, latestV2Only(getV2Only(), now), now);
  if (!next) return;
  writePrefs({ ...prefs, ...next });
  logDiag("info", "yjsSync", "room v2: compatibility window extended (old app version seen)");
}

/**
 * Pokoje, do których dołącza urządzenie: v3 zawsze; dla kodu krótkiego także v2 w oknie zgodności (30 dni od
 * aktualizacji albo od dołączenia po kodzie — grupa mogła zostać na starszych wersjach) i stary FNV po jawnym
 * włączeniu zgodności. Kod długi — sam v3: żadna wersja, która zna tylko starsze pokoje, nie przyjmie 28 znaków.
 */
export async function roomNamesFor(code: string): Promise<string[]> {
  const rooms = [await roomNameV3For(code)];
  if (codeKind(code) === "long") return rooms;
  if (v2CompatActive()) rooms.push(await roomNameV2For(code));
  if (readPrefs().legacyRoom) rooms.push(roomNameFor(code));
  return rooms;
}

export type NewCodeProposal = "v2" | "legacy" | null;

/**
 * Propozycja nowego kodu (§2.3): kod krótki, okno v2 się skończyło, a kod bywał w pokoju v2 albo najstarszym —
 * nazwy tych pokoi pozwalały zgadywać kod bez wolnego KDF. `legacy` ma pierwszeństwo (FNV da się odwrócić).
 */
export function newCodeProposal(now: number = Date.now()): NewCodeProposal {
  const p = readPrefs();
  if (!p.code || codeKind(p.code) !== "short") return null;
  if (p.v2Until === undefined || (typeof p.v2Until === "number" && now < p.v2Until)) return null;
  return p.legacyExposed ? "legacy" : p.v2Exposed ? "v2" : null;
}

const proposalSnapshot = () => `${newCodeProposal() ?? ""}|${readPrefs().newCodeHint}`;

/** Propozycja i to, czy baner na Dziś został zamknięty. */
export function useNewCodeProposal(): { kind: NewCodeProposal; dismissed: boolean } {
  const snap = useSyncExternalStore(subscribe, proposalSnapshot, () => "|open");
  const [kind, hint] = snap.split("|");
  return { kind: (kind || null) as NewCodeProposal, dismissed: hint === "dismissed" };
}

/** „Nie teraz” na banerze: chowa go na stałe; karta w ustawieniach zostaje, dopóki kod się nie zmieni. */
export function dismissNewCodeHint(): void {
  writePrefs({ ...readPrefs(), newCodeHint: "dismissed" });
}

export function getLegacyRoom(): boolean {
  return readPrefs().legacyRoom;
}

/** Włącza/wyłącza dołączanie do starego pokoju FNV; jeśli sync działa, łączy od nowa. */
export function setLegacyRoom(on: boolean): void {
  const prefs = readPrefs();
  writePrefs({ ...prefs, legacyRoom: on });
  // U-3: start licznika 30 dni ciszy przy włączeniu; wyłączenie go kasuje.
  if (on) markLegacyEnabled(); else clearLegacyIdle();
  logDiag("info", "yjsSync", `legacy room: ${on ? "on" : "off"}`);
  if (prefs.enabled && prefs.code) connect(prefs.code);
}

/**
 * Kody ze starszych wersji miały 8 znaków (≈ 40 bitów). Nazwa pokoju (SHA-256 kodu)
 * jest jawna dla serwera sygnalizacyjnego, a 2^40 skrótów to minuty na jednej karcie
 * graficznej — taki kod trzeba wymienić na nowy. (Nie mylić z kodem krótkim 12-znakowym.)
 */
export function isShortCode(code: string | null): boolean {
  return !!code && code.length < 12;
}

const DEVICE_NAME_KEY = "kaczy.sync.deviceName";
const DEVICE_NAME_MAX = 40;

/** Nazwa z przeglądarki, gdy użytkownik nie nazwał urządzenia. */
export function defaultDeviceName(ua: string = typeof navigator !== "undefined" ? navigator.userAgent : ""): string {
  return /Mobi|Android|iPhone|iPad/i.test(ua) ? "Telefon" : "Komputer";
}

export function getDeviceName(): string {
  try {
    const saved = localStorage.getItem(DEVICE_NAME_KEY)?.trim();
    if (saved) return saved.slice(0, DEVICE_NAME_MAX);
  } catch { /* brak dostępu do localStorage — zostaje nazwa domyślna */ }
  return defaultDeviceName();
}

/** Zapisuje nazwę tego urządzenia i od razu rozgłasza ją pozostałym (pusta = domyślna). */
export function setDeviceName(name: string): void {
  const clean = name.trim().slice(0, DEVICE_NAME_MAX);
  try {
    if (clean) localStorage.setItem(DEVICE_NAME_KEY, clean);
    else localStorage.removeItem(DEVICE_NAME_KEY);
  } catch (err) { logDiag("warn", "yjsSync", "cannot persist device name", err); }
  providers.forEach((p) => p.awareness.setLocalStateField("device", { name: getDeviceName(), ...localDeviceSchema() }));
}

// Id-ki awareness widziane przy poprzednim odczycie — nowe ponad to to „połączono”.
let previousDeviceIds = new Set<number>();

/** Nazwy innych urządzeń w awareness jednego pokoju (oczyszczone). */
function awarenessNames(p: WebrtcProvider | undefined): Set<string> {
  const out = new Set<string>();
  if (!p) return out;
  p.awareness.getStates().forEach((s, id) => {
    const name = (s as { device?: { name?: unknown } }).device?.name;
    const clean = typeof name === "string" ? cleanDeviceName(name).slice(0, DEVICE_NAME_MAX) : "";
    if (id !== p.awareness.clientID && clean) out.add(clean);
  });
  return out;
}

// Rodzaj pokoju każdego dostawcy (równolegle do `providers`).
type RoomKind = "v3" | "v2" | "legacy";
let roomKinds: RoomKind[] = [];
// Nazwa → od kiedy jest tylko w pokoju v2 (w tej sesji); po `V2_ONLY_GRACE_MS` trafia do `v2Only`.
const v2Pending = new Map<string, number>();
let v2OnlyTimer: ReturnType<typeof setTimeout> | null = null;
const V2_ONLY_REFRESH_MS = 60 * 60_000;

/**
 * Zaktualizowane urządzenie jest w obu pokojach, więc obecność tylko w v2 przez minutę oznacza starą wersję (§2.2).
 * Urządzenie widziane w v3 znika z `v2Only`.
 */
function observeV2Only(now: number = Date.now()): void {
  const map = getV2Only();
  const v2Index = roomKinds.indexOf("v2");
  if (v2Index < 0 && Object.keys(map).length === 0) return;
  const v3 = awarenessNames(providers[roomKinds.indexOf("v3")]);
  v3.forEach((n) => { if (Object.prototype.hasOwnProperty.call(map, n)) clearV2Only(n); });
  if (v2Index < 0) return;
  const onlyV2 = new Set([...awarenessNames(providers[v2Index])].filter((n) => !v3.has(n)));
  for (const n of [...v2Pending.keys()]) if (!onlyV2.has(n)) v2Pending.delete(n);
  const due: string[] = [];
  for (const n of onlyV2) {
    const since = v2Pending.get(n) ?? now;
    v2Pending.set(n, since);
    if (now - since >= V2_ONLY_GRACE_MS && now - (map[n] ?? 0) >= V2_ONLY_REFRESH_MS) due.push(n);
  }
  if (due.length) recordV2Only(due, now);
  if (onlyV2.size && !v2OnlyTimer) v2OnlyTimer = setTimeout(() => { v2OnlyTimer = null; observeV2Only(); }, V2_ONLY_GRACE_MS);
}

/**
 * Lista innych urządzeń z awareness pokoju v3 (`providers[0]`). Każdy provider ma własny
 * awareness i własne clientID, więc urządzenie widoczne tylko w starszym pokoju (stara
 * wersja) nie pojawi się tu — o takim mówi komunikat `v2Only` w ustawieniach.
 */
function refreshDevices() {
  const awareness = providers[0]?.awareness;
  if (!awareness) return;
  const devices: SyncDevice[] = [];
  awareness.getStates().forEach((s, id) => {
    const dev = (s as { device?: { name?: unknown; version?: unknown; schema?: unknown } }).device;
    const name = dev?.name;
    // Nazwa od innego urządzenia bez znaków sterujących (podszywanie się odwróconym tekstem), przegląd bezpieczeństwa Etapu 5.
    const shown = typeof name === "string" ? cleanDeviceName(name).slice(0, DEVICE_NAME_MAX) : "";
    if (id !== awareness.clientID && shown) {
      devices.push({ id, name: shown, version: cleanVersionClaim(dev?.version), schema: cleanSchemaClaim(dev?.schema) });
    }
  });
  const ids = new Set(devices.map((d) => d.id));
  devices.filter((d) => !previousDeviceIds.has(d.id)).forEach((d) => toast.success(`Połączono z: ${d.name}`));
  // 5.6: „ostatnio widziane” — obecne teraz i te, które właśnie odeszły (lokalnie, nie w Yjs).
  const left = state.devices.filter((d) => !ids.has(d.id)).map((d) => d.name);
  recordSeenDevices([...devices.map((d) => d.name), ...left]);
  previousDeviceIds = ids;
  setState({ devices });
  observeV2Only();
  tickRekeyDevices(devices.map((d) => d.name));
}

function setState(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  emit();
}

// ── wymiana kodu: zatrzymanie po znaczniku (§3.3) ─────────────────────────────

// Tag kodu, z którym urządzenie się łączy (asynchroniczny — liczony raz w `connect`).
let codeTag: { code: string; tag: string } | null = null;

/**
 * Znacznik, który zatrzymuje synchronizację z tym kodem; `null` = można działać (także gdy tagu nie ma).
 * Własny znacznik jest pomijany tylko przed przełączeniem (`prepared`/`seeded` — musi się rozejść); od `marked`
 * to urządzenie nie może już łączyć się starym kodem, nawet gdy przełączenie się nie udało albo prowadzi je inna karta.
 */
function rekeyStop(code: string) {
  if (codeTag?.code !== code) return null;
  const r = loadRekeyRecord();
  const ownId = r && (r.step === "prepared" || r.step === "seeded") ? r.id : null;
  return stoppingMarker(yjsStore.doc, codeTag.tag, readPrefs().ignoredRekey, ownId);
}

/** Bramka wysyłki: zamknięta, dopóki tag tego kodu nie jest policzony. */
const maySend = (code: string): boolean => codeTag?.code === code && !rekeyStop(code);

/** Liczy tag kodu: `ok` — wolno się połączyć, `stop` — znacznik, `error` — nie da się sprawdzić (zamknięte). */
async function rekeyGate(code: string): Promise<"ok" | "stop" | "error"> {
  try {
    const tag = await rekeyTag(await roomNameV3For(code));
    codeTag = { code, tag };
  } catch (err) {
    logDiag("warn", "yjsSync", "cannot compute rekey tag", err);
    return "error";
  }
  return rekeyStop(code) ? "stop" : "ok";
}

// Przekaźnik pyta przed każdym żądaniem wysyłki (I-3): po znaczniku nic już nie wychodzi, nawet przed rozłączeniem.
setRelayGate(maySend);

/** Restart przekaźnika po zmianie jego adresu — tylko przez bramkę (nie w `rekeyed`, nie przed policzeniem tagu). */
export function restartRelay(): void {
  const code = state.code;
  if (!code || state.status === "disabled" || state.status === "rekeyed") return;
  // Tag jeszcze się liczy: `connect` sam wystartuje przekaźnik z nowym adresem po bramce.
  if (maySend(code)) void startRelay(code);
}

function haltRekeyed(): void {
  disconnectProvider();
  setState({ status: "rekeyed", peerCount: 0 });
  logDiag("warn", "yjsSync", "sync code was changed on another device — sync stopped");
}

/**
 * Zmiana mapy `syncControl` (wywoływane synchronicznie w `applyUpdate`). Inna karta tego urządzenia mogła już
 * przejść na nowy kod (I-5) — wtedy idziemy za nią; inaczej znacznik dla naszego kodu zatrzymuje synchronizację.
 * Samo rozłączenie po bieżącej transakcji: bramka przekaźnika blokuje wysyłkę już teraz.
 */
function onSyncControl(): void {
  const code = state.code;
  if (!code || state.status === "disabled" || state.status === "rekeyed") return;
  const prefs = readPrefs();
  if (prefs.code !== code) { queueMicrotask(followPrefs); return; }
  if (rekeyStop(code)) queueMicrotask(() => { if (state.code === code && state.status !== "rekeyed" && rekeyStop(code)) haltRekeyed(); });
}
yjsStore.doc.getMap(SYNC_CONTROL_MAP).observe(onSyncControl);

function connect(code: string) {
  disconnectProvider();
  const token = ++connectToken;
  lastConnectAt = Date.now();
  extendV2IfNeeded();
  setState({ status: "connecting", peerCount: 0, code, signalingUp: 0, signalingTotal: 0 });
  // Najpierw sprawdzenie znacznika „kod zmieniony” — przekaźnik, obrazy i WebRTC ruszają dopiero po nim.
  const gate = rekeyGate(code);
  void gate.then((verdict) => {
    if (token !== connectToken) return;
    if (verdict === "stop") { haltRekeyed(); return; }
    if (verdict === "error") { disconnectProvider(); setState({ status: "connecting", lastError: "Nie udało się sprawdzić kodu synchronizacji" }); return; }
    startImageSync(code);
    void startRelay(code);
  });
  // y-webrtc is ~the heaviest dep in the app but sync is opt-in and off by
  // default — load it only once a connection is actually requested, instead
  // of forcing it into the eager main bundle for every visitor.
  Promise.all([import("y-webrtc"), roomNamesFor(code), gate]).then(([{ WebrtcProvider }, rooms, verdict]) => {
    if (token !== connectToken || verdict !== "ok") return; // superseded by a later connect()/disconnect()
    const legacyName = roomNameFor(code);
    roomKinds = rooms.map((room, i) => (i === 0 ? "v3" : room === legacyName ? "legacy" : "v2"));
    // Kod bywał w starszych pokojach — podstawa propozycji nowego kodu po końcu okna (§2.3).
    const prefs = readPrefs();
    const v2Exposed = prefs.v2Exposed || roomKinds.includes("v2");
    const legacyExposed = prefs.legacyExposed || roomKinds.includes("legacy");
    if (prefs.code === code && (v2Exposed !== prefs.v2Exposed || legacyExposed !== prefs.legacyExposed)) {
      writePrefs({ ...prefs, v2Exposed, legacyExposed });
    }
    // Jeden dokument, po providerze na pokój.
    const connected = rooms.map(() => false);
    const peers = rooms.map(() => 0);
    providers = rooms.map((room, i) => {
      const p = new WebrtcProvider(room, yjsStore.doc, providerOptions(code));
      // D-U1: wiadomości > 192 KiB idą ramkami (Chrome odrzuca > 256 KiB, a y-webrtc połyka błąd).
      chunkProvider(p as never, { maxBytes: 64 * 1024 * 1024 }, `yjs ${i}`);
      p.awareness.setLocalStateField("device", { name: getDeviceName(), ...localDeviceSchema() });
      p.awareness.on("change", refreshDevices);
      p.on("status", ({ connected: c }: { connected: boolean }) => {
        logDiag("info", "yjsSync", `${c ? "signaling connected" : "signaling disconnected"} (room ${i})`);
        connected[i] = c;
        setState({ status: connected.some(Boolean) ? "connected" : "connecting", signalingUp: connected.filter(Boolean).length, signalingTotal: rooms.length });
      });
      p.on("peers", ({ webrtcPeers, bcPeers }: { webrtcPeers: string[]; bcPeers: string[] }) => {
        peers[i] = webrtcPeers.length + bcPeers.length;
        // U-3: widziane urządzenie w starym pokoju FNV przesuwa termin wygaszenia zgodności.
        if (roomKinds[i] === "legacy" && peers[i] > 0) markLegacySeen();
        // Nowe urządzenia są we wszystkich pokojach, stare tylko w starszych — suma liczyłaby
        // nowe wielokrotnie, a maksimum daje liczbę urządzeń.
        const peerCount = Math.max(...peers);
        if (peerCount !== state.peerCount) logDiag("info", "yjsSync", `peers: ${peerCount}`);
        setState({ peerCount });
      });
      if (i === 0) watchRelayHeads(p);
      return p;
    });
    logDiag("info", "yjsSync", `provider started (${rooms.length} rooms)`);
  }).catch((err) => {
    if (token !== connectToken) return;
    logDiag("error", "yjsSync", "cannot load WebRTC transport", err);
    setState({ lastError: err instanceof Error ? err.message : String(err) });
  });
}

// Zmiana przyszła od peera wtedy, gdy jej źródłem jest pokój y-webrtc —
// `readSyncMessage(…, room)` nadaje go jako origin transakcji.
/** `updatedAt` notatek przy poprzednim zdalnym zapisie — po różnicy wiadomo, którą notatkę zmieniono. */
let remoteSeenUpdated: Map<string, number> | null = null;

/**
 * Tytuł notatki zmienionej zdalnie (najnowsza z różnic względem poprzedniego zdalnego zapisu).
 * Notatki prywatne i bez tytułu → `null`. Lokalne edycje między zdalnymi zapisami też trafiają
 * do porównania, więc przy kilku zmianach naraz to przybliżenie.
 */
function changedNoteTitle(): string | null {
  const notes = yjsStore.projectNotes();
  const prev = remoteSeenUpdated;
  remoteSeenUpdated = new Map(notes.map((n) => [n.id, n.updatedAt]));
  if (!prev) return null;
  let best: { title: string; at: number } | null = null;
  for (const n of notes) {
    const old = prev.get(n.id);
    if (n.locked || (old !== undefined && n.updatedAt <= old)) continue;
    if (!best || n.updatedAt > best.at) best = { title: n.title, at: n.updatedAt };
  }
  return best?.title.trim() || null;
}

yjsStore.doc.on("update", (_update: Uint8Array, origin: unknown) => {
  if (!origin || !providers.some((p) => origin === p.room)) return;
  const now = Date.now();
  const changed = changedNoteTitle();
  if (state.lastSyncedAt && now - state.lastSyncedAt < SYNCED_AT_THROTTLE_MS) return;
  // Komunikat tylko na widocznej karcie i co najwyżej raz na 30 s — seria zmian to jedno powiadomienie.
  if (document.visibilityState === "visible" && now - lastRemoteToastAt > REMOTE_TOAST_GAP_MS) {
    lastRemoteToastAt = now;
    toast("Zmiana z innego urządzenia", { description: changed ? `Zaktualizowano: ${changed}` : "Notatki są już zaktualizowane." });
  }
  setState({ lastSyncedAt: now });
});

/**
 * S2.3 §2.3: głowa pokoju przekaźnika w awareness pokoju v3 — najwyżej raz na 15 s (razem z odświeżaniem awareness),
 * i porównanie z sąsiadami przy każdej ich aktualizacji. Starsze pokoje tego nie niosą: to te same urządzenia.
 */
const RELAY_CLAIM_GAP_MS = 15_000;
let relayClaimAt = 0;
let relayClaimTimer: ReturnType<typeof setTimeout> | null = null;
let offRelayHead: (() => void) | null = null;

function publishRelayClaim(): void {
  const awareness = providers[0]?.awareness;
  if (!awareness) return;
  const wait = relayClaimAt + RELAY_CLAIM_GAP_MS - Date.now();
  if (wait > 0) {
    relayClaimTimer ??= setTimeout(() => {
      relayClaimTimer = null;
      publishRelayClaim();
    }, wait);
    return;
  }
  relayClaimAt = Date.now();
  awareness.setLocalStateField("relay", relayHeadClaim());
}

function watchRelayHeads(p: WebrtcProvider): void {
  offRelayHead?.();
  offRelayHead = onRelayHead(publishRelayClaim);
  p.awareness.on("update", () => {
    const others = new Map(p.awareness.getStates());
    others.delete(p.awareness.clientID);
    compareRelayHeads(others);
  });
}

function disconnectProvider() {
  connectToken++;
  offRelayHead?.();
  offRelayHead = null;
  if (relayClaimTimer) clearTimeout(relayClaimTimer);
  relayClaimTimer = null;
  relayClaimAt = 0;
  providers.forEach((p) => p.destroy());
  providers = [];
  roomKinds = [];
  v2Pending.clear();
  if (v2OnlyTimer) clearTimeout(v2OnlyTimer);
  v2OnlyTimer = null;
  stopImageSync();
  stopRelay();
  previousDeviceIds = new Set();
  recordSeenDevices(state.devices.map((d) => d.name));
  setState({ signalingUp: 0, signalingTotal: 0, devices: [] });
}

/**
 * Generuje nowy kod, włącza synchronizację i łączy się. Domyślnie kod długi (D-W1); `"short"` tylko dla
 * „Kod do przepisania ręcznie”. Nowa grupa: wszystkie jej urządzenia dołączą po tej wersji, więc bez pokoju v2.
 */
export function startPairing(kind: CodeKind = "long"): string {
  const code = generateCode(kind);
  writePrefs({ ...readPrefs(), ...freshCode(), enabled: true, code, shortCodeDropped: false, v2Until: null, v2Start: null });
  clearCodeScoped();
  connect(code);
  return code;
}

/**
 * Dołącza do grupy po kodzie (albo przełącza na nią). Kod rozpoznaje `parseCode` (12 albo 28 znaków z poprawnymi
 * znakami kontrolnymi); zwraca `null`, gdy kod jest zły. `v3` — link z `v=3`: grupa nie ma pokoju v2.
 */
export function joinWithCode(rawCode: string, opts: { v3?: boolean } = {}): string | null {
  const parsed = parseCode(rawCode);
  if (!parsed.code) return null;
  const code = parsed.code;
  const prefs = readPrefs();
  const now = Date.now();
  // Wcześniej zatrzymane znacznikiem: kolejka i kursor starego pokoju przekaźnika są już niepotrzebne (§3.3 p. 6).
  const leftRekeyed = state.status === "rekeyed" && prefs.code && prefs.code !== code ? prefs.code : null;
  if (prefs.code === code) {
    writePrefs({ ...prefs, enabled: true, shortCodeDropped: false });
  } else {
    // Grupa mogła powstać na starszej wersji (pokój v2) — przez 30 dni dołączamy do obu pokoi. Kod długi i link
    // z `v=3` mówią, że pokoju v2 nie ma.
    const noV2 = parsed.kind === "long" || opts.v3 === true;
    writePrefs({
      ...prefs, ...freshCode(), enabled: true, code, shortCodeDropped: false,
      v2Until: noV2 ? null : now + V2_COMPAT_MS, v2Start: noV2 ? null : now,
    });
    clearCodeScoped();
  }
  connect(code);
  if (leftRekeyed) void deriveRelayKeys(leftRekeyed).then((k) => forgetRelayRoom(k.roomId)).catch(() => undefined);
  return code;
}

/** Czy zapisany kod był krótki i został usunięty (do komunikatu w ustawieniach). */
export function wasShortCodeDropped(): boolean {
  return readPrefs().shortCodeDropped;
}

/** Disconnects but remembers the code, so re-enabling resumes the same group. */
export function pauseSync(): void {
  const prefs = readPrefs();
  writePrefs({ ...prefs, enabled: false });
  disconnectProvider();
  setState({ status: "disabled", peerCount: 0 });
}

/** Resumes a previously paused pairing, if any code is remembered. */
export function resumeSync(): void {
  const prefs = readPrefs();
  if (prefs.code) {
    writePrefs({ ...prefs, enabled: true });
    connect(prefs.code);
  }
}

/** Disconnects and forgets the pairing code entirely (leaves the group). */
export function forgetPairing(): void {
  // Serwery to konfiguracja, nie parowanie — zostają.
  writePrefs({ ...readPrefs(), ...freshCode(), enabled: false, code: null });
  clearCodeScoped();
  disconnectProvider();
  setState({ status: "disabled", peerCount: 0, code: null });
}

/**
 * „Synchronizuj dalej na starym kodzie” po `rekeyed`: znaczniki dla obecnego kodu trafiają na listę pominiętych
 * i synchronizacja rusza od nowa. Tylko gdy nikt z grupy kodu nie zmieniał (znacznik jest niezaufany).
 */
export function continueOnOldCode(): void {
  const prefs = readPrefs();
  const code = prefs.code;
  if (!code) return;
  const tag = codeTag?.code === code ? codeTag.tag : null;
  const ids = tag ? readMarkers(yjsStore.doc).filter((m) => m.tag === tag).map((m) => m.id) : [];
  const ignoredRekey = [...new Set([...prefs.ignoredRekey, ...ids])].slice(-IGNORED_REKEY_MAX);
  writePrefs({ ...prefs, ignoredRekey });
  logDiag("info", "yjsSync", "rekey marker ignored by user");
  if (prefs.enabled) connect(code);
}

// ── wymiana kodu na tym urządzeniu (§3.4; interfejs: Z-15.3) ─────────────────

/** Jednym zapisem ustawień przechodzi na nowy kod i łączy się nim. Rzuca, gdy zapis się nie udał. */
function switchToCode(newCode: string): void {
  const prefs = readPrefs();
  const next: SyncPrefs = { ...prefs, ...freshCode(), code: newCode, v2Until: null, v2Start: null, legacyRoom: false };
  if (!writePrefs(next)) throw new Error("Nie udało się zapisać ustawień synchronizacji");
  clearCodeScoped();
  if (next.enabled) connect(newCode);
}

const DEVICE_SEEN_MS = 90 * 24 * 60 * 60 * 1000;

/** Urządzenia do ponownego sparowania: połączone teraz i widziane w ostatnich 90 dniach, bez własnego. */
function rekeyDevices(now: number = Date.now()): { name: string; version?: string }[] {
  const own = getDeviceName();
  const out = new Map<string, { name: string; version?: string }>();
  for (const d of state.devices) out.set(d.name, { name: d.name, ...(d.version ? { version: d.version } : {}) });
  for (const [name, at] of Object.entries(getSeenDevices())) {
    if (now - at <= DEVICE_SEEN_MS && !out.has(name)) out.set(name, { name });
  }
  out.delete(own);
  return [...out.values()];
}

const ports = rekeyPorts({
  currentCode: () => readPrefs().code,
  newCode: () => generateCode("long"),
  tagFor: async (code) => rekeyTag(await roomNameV3For(code)),
  peers: () => state.peerCount,
  devices: () => rekeyDevices(),
  switchTo: switchToCode,
  applyMarker: (update) => Y.applyUpdate(yjsStore.doc, update),
});

async function driveRekey(opts: RunOptions = {}): Promise<RekeyResult> {
  const result = await runRekey(ports, opts);
  if (result.wait === "error") logDiag("warn", "yjsSync", `code change: step ${result.record?.error?.step} failed`, result.record?.error?.message);
  return result;
}

/** Krok 0 wymiany kodu: zapis i nowy kod; nic nie wychodzi z urządzenia, czeka na potwierdzenie. */
export const prepareCodeChange = (): Promise<RekeyResult> => prepareRekey(ports);
/** Kolejne kroki: po potwierdzeniu (`confirmed`), „Pomiń” (`skipMarker`), „Usuń teraz” (`retireNow`), „Ponów”. */
export const runCodeChange = (opts: RunOptions = {}): Promise<RekeyResult> => driveRekey(opts);
/** Anuluje wymianę, dopóki znacznik nie mógł wyjść z urządzenia. */
export const cancelCodeChange = (): Promise<boolean> => cancelRekey(ports);

/**
 * Zmiana zapisu wymiany pod blokadą (zapis może równolegle zmieniać sterownik). Zakończona wymiana bez urządzeń do
 * sparowania znika sama (§3.4: lista żyje, dopóki są nieodhaczone pozycje).
 */
function updateRekeyRecord(fn: (r: RekeyRecord) => RekeyRecord | null): Promise<unknown> {
  // Czeka w kolejce, nie odpuszcza: odhaczenie stuknięte w trakcie kroku sterownika nie może przepaść.
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  const withLock = (job: () => Promise<void>) => (locks?.request ? locks.request(REKEY_LOCK, job) : job());
  return withLock(async () => {
    const cur = loadRekeyRecord();
    if (!cur) return;
    const next = fn(cur);
    if (next === cur) return;
    saveRekeyRecord(next && rekeyFinished(next) ? null : next);
  }).catch((err) => logDiag("warn", "yjsSync", "cannot update code change record", err));
}

/** Urządzenie widoczne w awareness nowego pokoju odhacza się na liście do ponownego sparowania (§3.6). */
function tickRekeyDevices(names: readonly string[]): void {
  const r = loadRekeyRecord();
  if (!names.length || !r || (r.step !== "switched" && r.step !== "done") || state.code !== r.newCode) return;
  if (names.reduce(withDevicePaired, r) === r) return;
  void updateRekeyRecord((cur) => names.reduce(withDevicePaired, cur));
}

/** Ręczne odhaczenie urządzenia na liście do ponownego sparowania. */
export function markRekeyDevicePaired(name: string): Promise<unknown> {
  return updateRekeyRecord((cur) => withDevicePaired(cur, name));
}

/** „Zamknij listę” po zakończonej wymianie. */
export function dismissCodeChange(): Promise<unknown> {
  return updateRekeyRecord((cur) => (cur.step === "done" ? null : cur));
}

/** Call once at app startup, after yjsStore.ready(), to resume a prior session. */
let returnListenersBound = false;

/** Wraca do sieci albo do karty: jeśli sync jest włączony, a nie działa, łączymy od nowa. */
function reconnectIfNeeded() {
  const prefs = readPrefs();
  if (!prefs.enabled || !prefs.code || state.status === "connected" || state.status === "rekeyed") return;
  if (Date.now() - lastConnectAt < RECONNECT_MIN_GAP_MS) return;
  connect(prefs.code);
}

/** Łączy się kodem z ustawień, jeśli jeszcze nie jest z nim połączone. */
function connectFromPrefs(): void {
  const prefs = readPrefs();
  if (prefs.enabled && prefs.code && (state.code !== prefs.code || state.status === "disabled")) connect(prefs.code);
}

/**
 * I-5: karty tego samego urządzenia idą za kodem z ustawień. Zmiana kodu albo `enabled` w innej karcie →
 * połączenie nowym kodem albo rozłączenie; pominięty znacznik w innej karcie → wznowienie po `rekeyed`.
 */
function followPrefs(): void {
  const prefs = readPrefs();
  if (!prefs.enabled || !prefs.code) {
    if (state.status !== "disabled") disconnectProvider();
    setState({ status: "disabled", peerCount: 0, code: prefs.code });
    return;
  }
  if (prefs.code !== state.code || state.status === "disabled") connect(prefs.code);
  else if (state.status === "rekeyed" && !rekeyStop(prefs.code)) connect(prefs.code);
  else emit();
}

/** Kroki wymiany, które mogą iść bez użytkownika (po potwierdzeniu): przy starcie i po powrocie sieci. */
function resumeRekey(): void {
  const r = loadRekeyRecord();
  if (r && r.step !== "prepared" && r.step !== "done") void driveRekey().catch((err) => logDiag("warn", "yjsSync", "code change resume failed", err));
}

export function initSync(): void {
  const prefs = readPrefs();
  // Zapis sprzed pokoju v3: istniejąca grupa dostaje 30 dni na aktualizację pozostałych urządzeń.
  if (prefs.code && prefs.v2Until === undefined) {
    const now = Date.now();
    writePrefs({ ...prefs, v2Until: now + V2_COMPAT_MS, v2Start: now });
    logDiag("info", "yjsSync", "room v3: v2 compatibility window started");
  }
  if (!returnListenersBound && typeof window !== "undefined") {
    returnListenersBound = true;
    // Znaczniki starsze niż 180 dni (§3.2) — raz na start.
    if (pruneMarkers(yjsStore.doc, Date.now()) > 0) logDiag("info", "yjsSync", "old rekey markers pruned");
    window.addEventListener("online", () => { reconnectIfNeeded(); resumeRekey(); });
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reconnectIfNeeded(); });
    window.addEventListener("storage", (e) => {
      if (e.key === STORAGE_KEY || e.key === null) followPrefs();
      if (e.key === REKEY_STORAGE_KEY || e.key === null) notifyRekeyRecord();
    });
  }
  // I-6: wymiana w kroku `marked` najpierw kończy przełączenie — połączenie starym kodem byłoby krokiem wstecz.
  if (loadRekeyRecord()?.step === "marked") {
    void driveRekey().catch(() => undefined).finally(connectFromPrefs);
    return;
  }
  connectFromPrefs();
  resumeRekey();
}

/**
 * U-3: po 30 dniach bez urządzenia w starym pokoju wyłącza przełącznik. `true` = właśnie wyłączono
 * (wywołujący pokazuje komunikat). Włączenie sprzed tej funkcji startuje licznik od teraz.
 */
export function expireLegacyRoomIfIdle(now: number = Date.now()): boolean {
  if (!readPrefs().legacyRoom) return false;
  const state = readLegacyIdle();
  if (!state) { markLegacyEnabled(now); return false; }
  if (!legacyIdleExpired(state, now)) return false;
  setLegacyRoom(false);
  return true;
}
