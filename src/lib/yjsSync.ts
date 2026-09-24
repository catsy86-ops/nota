import { useSyncExternalStore } from "react";
import { WebrtcProvider } from "y-webrtc";
import { yjsStore } from "@/lib/yjsStore";

/**
 * Peer-to-peer transport for the Yjs doc (Phase 2 of the multi-device sync
 * project — see roadmap.md). Opt-in: disabled by default, no account, no
 * backend of our own. Pairing works through a short human-typable code that
 * doubles as the WebRTC signaling password; the room name is a hash of that
 * code so the (public, third-party) signaling servers never see it verbatim.
 *
 * Not synced here: images (deliberately kept device-local, see yjsStore.ts).
 */

const STORAGE_KEY = "kaczy.sync.v1";
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no ambiguous I/O/0/1/L
const CODE_LENGTH = 8;

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
  } catch {
    return DEFAULT_PREFS;
  }
}

function writePrefs(prefs: SyncPrefs) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
}

export type SyncStatus = "disabled" | "connecting" | "connected";

export interface SyncState {
  status: SyncStatus;
  peerCount: number;
  code: string | null;
}

const DEFAULT_STATE: SyncState = { status: "disabled", peerCount: 0, code: null };

let state: SyncState = { ...DEFAULT_STATE, code: readPrefs().code };
let provider: WebrtcProvider | null = null;
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

/**
 * Deterministic, non-cryptographic room name derived from the pairing code —
 * good enough to keep the code out of the room name sent to the (public,
 * third-party) signaling servers. Not a security boundary on its own; the
 * `password` option (the code itself) is what actually protects the
 * handshake, this just avoids leaking the code as plaintext room metadata.
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

function setState(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  emit();
}

function connect(code: string) {
  disconnectProvider();
  setState({ status: "connecting", peerCount: 0, code });
  provider = new WebrtcProvider(roomNameFor(code), yjsStore.doc, { password: code });
  provider.on("status", ({ connected }: { connected: boolean }) => {
    setState({ status: connected ? "connected" : "connecting" });
  });
  provider.on("peers", ({ webrtcPeers, bcPeers }: { webrtcPeers: string[]; bcPeers: string[] }) => {
    setState({ peerCount: webrtcPeers.length + bcPeers.length });
  });
}

function disconnectProvider() {
  provider?.destroy();
  provider = null;
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
  const code = rawCode.trim().toUpperCase();
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
