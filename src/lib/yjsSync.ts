import { useSyncExternalStore } from "react";
import type { WebrtcProvider } from "y-webrtc";
import { yjsStore } from "@/lib/yjsStore";
import { startImageSync, stopImageSync } from "@/lib/imageSync";
import { logDiag } from "@/lib/diagnostics";

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
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no ambiguous I/O/0/1/L
// 12 znaków z 31 ≈ 59 bitów (wcześniej 8 ≈ 40). Kod i tak zwykle idzie przez QR,
// więc długość nic nie kosztuje. Stare 8-znakowe kody działają dalej.
const CODE_LENGTH = 12;
/**
 * Okres przejściowy: urządzenie dołącza do pokoju SHA-256 **i** do starego
 * pokoju FNV. Starsza wersja aplikacji zna tylko stary pokój — bez tego
 * urządzenia na różnych wersjach cicho przestałyby się widzieć. Wyłączyć
 * dopiero wtedy, gdy wszystkie urządzenia mają już tę wersję.
 */
const JOIN_LEGACY_ROOM = true;

interface SyncPrefs {
  enabled: boolean;
  code: string | null;
}

const DEFAULT_PREFS: SyncPrefs = { enabled: false, code: null };

function readPrefs(): SyncPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch (err) {
    logDiag("warn", "yjsSync", "unreadable sync prefs, using defaults", err);
    return DEFAULT_PREFS;
  }
}

function writePrefs(prefs: SyncPrefs) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch (err) { logDiag("warn", "yjsSync", "cannot persist sync prefs", err); }
}

export type SyncStatus = "disabled" | "connecting" | "connected";

export interface SyncState {
  status: SyncStatus;
  peerCount: number;
  code: string | null;
  /** Kiedy ostatnio przyszła zmiana od innego urządzenia (ms). Tylko w tej sesji. */
  lastSyncedAt: number | null;
  /** Ostatni błąd transportu — żeby „nie synchronizuje się” miało odpowiedź. */
  lastError: string | null;
}

const DEFAULT_STATE: SyncState = { status: "disabled", peerCount: 0, code: null, lastSyncedAt: null, lastError: null };
// Zmiany od peerów potrafią przychodzić seriami; odświeżamy znacznik co najwyżej
// raz na kilka sekund, żeby nie przerenderowywać Ustawień przy każdej.
const SYNCED_AT_THROTTLE_MS = 5000;

let state: SyncState = { ...DEFAULT_STATE, code: readPrefs().code };
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

/** Random human-typable pairing code. */
export function generateCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return Array.from(bytes).map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

/** Kod z pola lub linku: wielkie litery, bez spacji i myślników (kod jest wyświetlany w grupach). */
export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[\s-]/g, "");
}

/** Kod w grupach po 4 znaki — łatwiej przepisać z ekranu. */
export function formatCode(code: string): string {
  return code.match(/.{1,4}/g)?.join(" ") ?? code;
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

/** Pokoje, do których dołącza urządzenie: nowy zawsze, stary w okresie przejściowym. */
export async function roomNamesFor(code: string): Promise<string[]> {
  const v2 = await roomNameV2For(code);
  return JOIN_LEGACY_ROOM ? [v2, roomNameFor(code)] : [v2];
}

function setState(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  emit();
}

function connect(code: string) {
  disconnectProvider();
  const token = ++connectToken;
  setState({ status: "connecting", peerCount: 0, code });
  // y-webrtc is ~the heaviest dep in the app but sync is opt-in and off by
  // default — load it only once a connection is actually requested, instead
  // of forcing it into the eager main bundle for every visitor.
  Promise.all([import("y-webrtc"), roomNamesFor(code)]).then(([{ WebrtcProvider }, rooms]) => {
    if (token !== connectToken) return; // superseded by a later connect()/disconnect()
    // Jeden dokument, po providerze na pokój (patrz `JOIN_LEGACY_ROOM`).
    const connected = rooms.map(() => false);
    const peers = rooms.map(() => 0);
    providers = rooms.map((room, i) => {
      const p = new WebrtcProvider(room, yjsStore.doc, { password: code });
      p.on("status", ({ connected: c }: { connected: boolean }) => {
        logDiag("info", "yjsSync", `${c ? "signaling connected" : "signaling disconnected"} (room ${i})`);
        connected[i] = c;
        setState({ status: connected.some(Boolean) ? "connected" : "connecting" });
      });
      p.on("peers", ({ webrtcPeers, bcPeers }: { webrtcPeers: string[]; bcPeers: string[] }) => {
        peers[i] = webrtcPeers.length + bcPeers.length;
        // Nowe urządzenia są w obu pokojach, stare tylko w starym — suma liczyłaby
        // nowe podwójnie, a maksimum daje liczbę urządzeń.
        const peerCount = Math.max(...peers);
        if (peerCount !== state.peerCount) logDiag("info", "yjsSync", `peers: ${peerCount}`);
        setState({ peerCount });
      });
      return p;
    });
    logDiag("info", "yjsSync", `provider started (${rooms.length} rooms)`);
  }).catch((err) => {
    if (token !== connectToken) return;
    logDiag("error", "yjsSync", "cannot load WebRTC transport", err);
    setState({ lastError: err instanceof Error ? err.message : String(err) });
  });
  startImageSync(code);
}

// Zmiana przyszła od peera wtedy, gdy jej źródłem jest pokój y-webrtc —
// `readSyncMessage(…, room)` nadaje go jako origin transakcji.
yjsStore.doc.on("update", (_update: Uint8Array, origin: unknown) => {
  if (!origin || !providers.some((p) => origin === p.room)) return;
  const now = Date.now();
  if (state.lastSyncedAt && now - state.lastSyncedAt < SYNCED_AT_THROTTLE_MS) return;
  setState({ lastSyncedAt: now });
});

function disconnectProvider() {
  connectToken++;
  providers.forEach((p) => p.destroy());
  providers = [];
  stopImageSync();
}

/** Generates a fresh pairing code, enables sync and connects. Returns the code. */
export function startPairing(): string {
  const code = generateCode();
  writePrefs({ enabled: true, code });
  connect(code);
  return code;
}

/** Joins (or switches to) an existing pairing group by code. */
export function joinWithCode(rawCode: string): string {
  const code = normalizeCode(rawCode);
  writePrefs({ enabled: true, code });
  connect(code);
  return code;
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
  writePrefs({ enabled: false, code: null });
  disconnectProvider();
  setState({ status: "disabled", peerCount: 0, code: null });
}

/** Call once at app startup, after yjsStore.ready(), to resume a prior session. */
export function initSync(): void {
  const prefs = readPrefs();
  if (prefs.enabled && prefs.code) connect(prefs.code);
}
