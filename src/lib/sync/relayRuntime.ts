import { useSyncExternalStore } from "react";
import { createStore, get as idbGet, set as idbSet, del as idbDel, type UseStore } from "idb-keyval";
import { yjsStore } from "@/lib/yjsStore";
import { logDiag } from "@/lib/diagnostics";
import { toast } from "sonner";
import { deriveRelayKeys } from "@/lib/sync/relayKeys";
import { RelayProvider, type RelayState, type RelayStatus, type RelayStore } from "@/lib/sync/relayProvider";
import { RelayBlobs } from "@/lib/sync/relayBlobs";

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
  /** Ostatnie udane wysłanie albo pobranie (ms), do „ostatnio zsynchronizowano”. */
  syncedAt: number | null;
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

function idbRelayStore(roomId: string): RelayStore {
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

// ── start / stop ─────────────────────────────────────────────────────────────

let provider: RelayProvider | null = null;
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

export async function startRelay(code: string): Promise<void> {
  stopRelay();
  const url = validRelayUrl(getRelayUrl());
  if (!url) return;
  const token = ++startToken;
  setView({ status: "connecting", detail: undefined });
  try {
    const keys = await deriveRelayKeys(code);
    if (token !== startToken) return; // zastąpione przez późniejszy start albo stop
    const p = new RelayProvider({
      baseUrl: url,
      keys,
      doc: yjsStore.doc,
      store: idbRelayStore(keys.roomId),
      openSocket: (wsUrl) => new WebSocket(wsUrl),
      onRemoteChange: () => {
        scheduleBlobs(0);
        // Jak w yjsSync: tylko na widocznej karcie i co 30 s, seria zmian to jedno powiadomienie.
        const now = Date.now();
        if (document.visibilityState !== "visible" || now - lastRemoteToastAt < REMOTE_TOAST_GAP_MS) return;
        lastRemoteToastAt = now;
        toast("Zmiana z innego urządzenia", { description: "Przyszła przez przekaźnik." });
      },
      onStatus: (status, detail) => {
        if (token !== startToken) return;
        setView({ status, detail, ...(status === "online" ? { syncedAt: Date.now() } : {}) });
        if (status === "error") logDiag("error", "relay", detail ?? "błąd przekaźnika");
      },
    });
    provider = p;
    blobs = new RelayBlobs({ baseUrl: url, keys, refs: () => yjsStore.syncableRefs(), images: yjsStore.images });
    const onNotes = () => scheduleBlobs();
    yjsStore.notesMap.observeDeep(onNotes);
    unobserveNotes = () => yjsStore.notesMap.unobserveDeep(onNotes);
    // Karta chowana: wysyłamy od razu, zanim system zamrozi stronę. Wracamy: nadrabiamy.
    onVisibility = () => p.setHidden(document.visibilityState === "hidden");
    onOnline = () => p.sync();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    await p.start();
  } catch (err) {
    if (token !== startToken) return;
    logDiag("error", "relay", "nie udało się uruchomić przekaźnika", err);
    setView({ status: "error", detail: "Nie udało się uruchomić przekaźnika" });
  }
}

export function stopRelay(): void {
  startToken++;
  if (onVisibility) document.removeEventListener("visibilitychange", onVisibility);
  if (onOnline) window.removeEventListener("online", onOnline);
  onVisibility = null;
  onOnline = null;
  provider?.stop();
  provider = null;
  blobs = null;
  if (blobTimer) clearTimeout(blobTimer);
  blobTimer = null;
  blobRerun = false;
  unobserveNotes?.();
  unobserveNotes = null;
  setView({ status: "idle", detail: undefined });
}
