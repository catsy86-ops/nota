import { useCallback, useSyncExternalStore } from "react";
import { cleanSchemaClaim, cleanVersionClaim, localDeviceSchema, type DeviceSchema } from "@/lib/formatSchema";
import { cleanDeviceName } from "@/lib/syncSeen";
import { SYNC } from "@/lib/storage/names";

/**
 * Rejestr urządzeń w dokumencie (D4.1, `docs/plan-migracje-yjs-2026-11-15.md`). Mapa `devices`: klucz = losowy, stały
 * identyfikator urządzenia (nie nazwa), wartość `{ name, schema, version, at }`. W przeciwieństwie do `syncSeen`
 * (lokalne, kluczowane nazwą) wpis jest częścią dokumentu, więc dochodzi każdą drogą — WebRTC, przekaźnikiem, plikiem.
 *
 * Mapa nie wchodzi do kopii JSON (kopia ma jawne sekcje), a identyfikator — do kopii ustawień (`SETTINGS_KEYS`):
 * przywrócona kopia wniosłaby urządzenia, których już nie ma, a dwie instalacje z jednym identyfikatorem nadpisywałyby
 * sobie wpis. Wartości od innych urządzeń są niezaufane i czyszczone jak deklaracje z awareness.
 */

export const DEVICES_MAP = "devices";
export const DEVICE_ID_KEY = SYNC.deviceId;
const ID_RE = /^[a-z0-9]{8,32}$/;
const DAY = 86_400_000;
/** Własny wpis odświeżany najwyżej raz na dobę — każde nadpisanie zostaje w historii dokumentu. */
const REFRESH_MS = DAY;
/** Wpisy starsze usuwa pierwsze urządzenie, które je zobaczy. */
export const FORGET_AFTER_MS = 180 * DAY;
/** Urządzenie niewidziane dłużej nie blokuje nowego formatu (D4.2). */
export const ACTIVE_MS = 30 * DAY;
const MAX_READ = 50;

export interface DeviceEntry extends DeviceSchema {
  id: string;
  name: string;
  at: number;
}

interface MapLike {
  observe(fn: () => void): void;
  unobserve(fn: () => void): void;
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  delete(key: string): void;
  forEach(fn: (value: unknown, key: string) => void): void;
}
interface DocLike {
  getMap(name: string): unknown;
  transact(fn: () => void, origin?: unknown): void;
}
const devicesMap = (doc: DocLike) => doc.getMap(DEVICES_MAP) as MapLike;

let memId: string | null = null;

/** Stały, losowy identyfikator tej instalacji (nowy klucz lokalny; bez localStorage — na czas sesji). */
export function getLocalDeviceId(): string {
  if (memId) return memId;
  try {
    const stored = localStorage.getItem(DEVICE_ID_KEY);
    if (stored && ID_RE.test(stored)) return (memId = stored);
  } catch { /* prywatne okno */ }
  const id = Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => (b % 36).toString(36)).join("") + Date.now().toString(36).slice(-6);
  try { localStorage.setItem(DEVICE_ID_KEY, id); } catch { /* zostaje w pamięci */ }
  return (memId = id);
}

/** Wpis z dokumentu po czyszczeniu; `at` z przyszłości (ponad dobę) liczone jak `now`. */
export function cleanDeviceEntry(id: string, raw: unknown, now: number): DeviceEntry | undefined {
  if (!ID_RE.test(id) || !raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === "string" ? cleanDeviceName(r.name) : "";
  if (typeof r.at !== "number" || !Number.isFinite(r.at) || r.at < 0) return undefined;
  const at = r.at > now + DAY ? now : r.at;
  return { id, name: name || "Urządzenie", schema: cleanSchemaClaim(r.schema), version: cleanVersionClaim(r.version), at };
}

/** Najwyżej 50 wpisów o najnowszym `at`, od najnowszego. */
export function readDevices(doc: DocLike, now = Date.now()): DeviceEntry[] {
  const out: DeviceEntry[] = [];
  devicesMap(doc).forEach((value, key) => {
    const e = cleanDeviceEntry(key, value, now);
    if (e) out.push(e);
  });
  return out.sort((a, b) => b.at - a.at).slice(0, MAX_READ);
}

export const DEVICE_REGISTRY_ORIGIN = "device-registry";

/**
 * Dopisuje albo odświeża wpis tego urządzenia, gdy zmieniła się nazwa, format albo wersja, albo wpis ma ponad dobę;
 * przy okazji usuwa wpisy starsze niż 180 dni i niepoprawne. `true` — coś zapisano.
 */
export function recordLocalDevice(doc: DocLike, name: string, now = Date.now(), id = getLocalDeviceId(), self = localDeviceSchema()): boolean {
  const map = devicesMap(doc);
  const mine = cleanDeviceEntry(id, map.get(id), now);
  const clean = cleanDeviceName(name).slice(0, 40) || "Urządzenie";
  const stale: string[] = [];
  map.forEach((value, key) => {
    if (key === id) return;
    const e = cleanDeviceEntry(key, value, now);
    if (!e || now - e.at > FORGET_AFTER_MS) stale.push(key);
  });
  const fresh = mine && mine.name === clean && mine.schema === self.schema && mine.version === self.version && now - mine.at < REFRESH_MS;
  if (fresh && stale.length === 0) return false;
  doc.transact(() => {
    for (const k of stale) map.delete(k);
    if (!fresh) map.set(id, { name: clean, schema: self.schema, version: self.version, at: now });
  }, DEVICE_REGISTRY_ORIGIN);
  return true;
}

/** „Zapomnij urządzenie” (D4.3): wpis wróci, gdy urządzenie znów się uruchomi. */
export function forgetDevice(doc: DocLike, id: string): void {
  if (!ID_RE.test(id)) return;
  doc.transact(() => devicesMap(doc).delete(id), DEVICE_REGISTRY_ORIGIN);
}

/** Pozostałe urządzenia widziane w ostatnich 30 dniach — liczone przez bramkę formatu (D4.2). */
export function activeOtherDevices(doc: DocLike, now = Date.now(), selfId = getLocalDeviceId()): DeviceEntry[] {
  return readDevices(doc, now).filter((d) => d.id !== selfId && now - d.at <= ACTIVE_MS);
}

/** Niewidziane ponad 30 dni i ze starszym formatem — „może stracić dane, zaktualizuj przed użyciem”. */
export function dormantOlderDevices(doc: DocLike, current: number, now = Date.now(), selfId = getLocalDeviceId()): DeviceEntry[] {
  return readDevices(doc, now).filter((d) => d.id !== selfId && now - d.at > ACTIVE_MS && (d.schema ?? 0) < current);
}

/** Rejestr dla interfejsu (D4.3); odświeża się przy zmianie mapy, także z innego urządzenia. */
export function useRegistryDevices(doc: DocLike): DeviceEntry[] {
  const subscribe = useCallback((cb: () => void) => {
    const map = devicesMap(doc);
    map.observe(cb);
    return () => map.unobserve(cb);
  }, [doc]);
  // Migawka jako napis: `useSyncExternalStore` wymaga stabilnej wartości między renderami.
  const snap = useSyncExternalStore(subscribe, () => JSON.stringify(readDevices(doc)));
  return JSON.parse(snap) as DeviceEntry[];
}

/** Test-only. */
export function resetDeviceIdForTests(): void {
  memId = null;
}
