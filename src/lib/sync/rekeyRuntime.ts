import { useSyncExternalStore } from "react";
import { yjsStore } from "@/lib/yjsStore";
import { withLockIfFree } from "@/lib/tabLock";
import { deriveRelayKeys } from "@/lib/sync/relayKeys";
import { forgetRelayRoom, getRelayUrl, idbRelayStore, validRelayUrl } from "@/lib/sync/relayRuntime";
import { REKEY_LOCK, REKEY_STORAGE_KEY, parseRekeyRecord, type RekeyPorts, type RekeyRecord } from "@/lib/sync/rekey";

/**
 * Porty produkcyjne wymiany kodu (sesja D2, `docs/plan-wymiana-kodu.md` §3.4). To, co zależy od
 * połączenia (kod, przełączenie, liczba urządzeń, dokument), wstrzykuje `yjsSync.ts` przez `RekeyHost` —
 * ten moduł go nie importuje, bo `yjsSync` importuje ten.
 */

// ── zapis wymiany ────────────────────────────────────────────────────────────

const listeners = new Set<() => void>();
// Ostatnio przeczytany tekst i jego wynik: hook dostaje ten sam obiekt, dopóki zapis się nie zmieni.
let cachedRaw: string | null | undefined;
let cached: RekeyRecord | null = null;

export function loadRekeyRecord(): RekeyRecord | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(REKEY_STORAGE_KEY);
  } catch {
    return null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = parseRekeyRecord(raw);
  }
  return cached;
}

/** `null` usuwa zapis. Rzuca, gdy zapis się nie udał — sterownik wtedy nie idzie dalej. */
export function saveRekeyRecord(record: RekeyRecord | null): void {
  if (record) localStorage.setItem(REKEY_STORAGE_KEY, JSON.stringify(record));
  else localStorage.removeItem(REKEY_STORAGE_KEY);
  notifyRekeyRecord();
}

/** Zapis zmienił się w innej karcie (zdarzenie `storage`) albo tutaj. */
export function notifyRekeyRecord(): void {
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useRekeyRecord(): RekeyRecord | null {
  return useSyncExternalStore(subscribe, loadRekeyRecord, () => null);
}

// ── porty ────────────────────────────────────────────────────────────────────

export interface RekeyHost {
  currentCode(): string | null;
  newCode(): string;
  tagFor(code: string): Promise<string>;
  peers(): number;
  devices(): { name: string; version?: string }[];
  switchTo(newCode: string): void;
  /** Nakłada aktualizację znacznika na główny dokument (Yjs wolno tylko w `yjsSync.ts`). */
  applyMarker(update: Uint8Array): void;
}

// Kod przekaźnika do wymiany ładowany dopiero przy wymianie — zwykła synchronizacja go nie potrzebuje.
const relayOps = () => import("@/lib/sync/rekeyRelay");

export function rekeyPorts(host: RekeyHost): RekeyPorts {
  return {
    now: () => Date.now(),
    load: loadRekeyRecord,
    save: saveRekeyRecord,
    currentCode: () => host.currentCode(),
    newCode: () => host.newCode(),
    tagFor: (code) => host.tagFor(code),
    relayUrl: () => validRelayUrl(getRelayUrl()),
    devices: () => host.devices(),
    async seedRoom(relay, newCode) {
      const [{ seedRekeyRoom }, keys] = await Promise.all([relayOps(), deriveRelayKeys(newCode)]);
      await seedRekeyRoom({ baseUrl: relay }, newCode, yjsStore.doc, idbRelayStore(keys.roomId));
    },
    async dropRoom(relay, code) {
      await (await relayOps()).dropRekeyRoom({ baseUrl: relay }, code);
    },
    applyMarker: (update) => host.applyMarker(update),
    async postMarker(relay, oldCode, update) {
      await (await relayOps()).postRekeyMarker({ baseUrl: relay }, oldCode, update);
    },
    peers: () => host.peers(),
    wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    switchTo: (newCode) => host.switchTo(newCode),
    async retireRoom(relay, oldCode, update) {
      return (await relayOps()).retireRekeyRoom({ baseUrl: relay }, oldCode, update);
    },
    async forgetRoom(oldCode) {
      await forgetRelayRoom((await deriveRelayKeys(oldCode)).roomId);
    },
    lock: (fn) => withLockIfFree(REKEY_LOCK, fn),
  };
}
