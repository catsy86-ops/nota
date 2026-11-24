import * as Y from "yjs";
import { deriveRelayKeys, openBytes, relayAad, sealBytes, RELAY_KDF_ITERATIONS, type RelayKeys } from "@/lib/sync/relayKeys";
import { RelayProvider, type RelayStore } from "@/lib/sync/relayProvider";
import { endpointFetch } from "@/lib/net/endpoints";

/**
 * Operacje na przekaźniku potrzebne przy wymianie kodu (`rekey.ts`, `docs/plan-wymiana-kodu.md` §3.4):
 * zasilenie nowego pokoju, wpis znacznika do starego, wycofanie starego pokoju do „nagrobka”.
 * Poza zasileniem żadna z nich nie niesie danych użytkownika i żadna nie nakłada niczego na
 * główny dokument (I-2).
 */

export interface RekeyRelayOptions {
  baseUrl: string;
  fetch?: typeof fetch;
  /** Tylko dla testów — produkcyjnie zawsze `RELAY_KDF_ITERATIONS`. */
  iterations?: number;
  timeoutMs?: number;
}

const MAX_PAGES = 1000;
const TOMBSTONE_TRIES = 3;

class HttpError extends Error {
  constructor(readonly status: number) {
    super(`Przekaźnik odpowiedział kodem ${status}`);
  }
}

function client(opts: RekeyRelayOptions, keys: RelayKeys) {
  const base = opts.baseUrl.replace(/\/+$/, "");
  const fetchFn = opts.fetch ?? endpointFetch;
  return async <T>(method: "GET" | "POST" | "DELETE", path: string, body?: unknown): Promise<T> => {
    const res = await fetchFn(`${base}/rooms/${keys.roomId}${path}`, {
      method,
      headers: { Authorization: `Bearer ${keys.token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000),
    });
    if (!res.ok) throw new HttpError(res.status);
    return (await res.json().catch(() => ({}))) as T;
  };
}

const keysFor = (opts: RekeyRelayOptions, code: string) => deriveRelayKeys(code, opts.iterations ?? RELAY_KDF_ITERATIONS);

/** Wszystkie wpisy pokoju, odszyfrowane; `null` = pokoju nie ma. Niczego nie nakłada na dokument. */
async function readRoom(opts: RekeyRelayOptions, keys: RelayKeys): Promise<Uint8Array[] | null> {
  const http = client(opts, keys);
  const out: Uint8Array[] = [];
  let since = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    let res: { entries?: { seq: number; data: string }[]; hasMore?: boolean };
    try {
      res = await http("GET", `/updates?since=${since}`);
    } catch (err) {
      if (err instanceof HttpError && err.status === 404) return null;
      throw err;
    }
    if (!Array.isArray(res.entries)) throw new Error("Przekaźnik zwrócił nieprawidłową odpowiedź");
    for (const e of res.entries) {
      if (typeof e?.seq !== "number" || !(e.seq > since) || typeof e.data !== "string") throw new Error("Przekaźnik zwrócił nieprawidłowy wpis");
      out.push(await openBytes(keys.dataKey, e.data, relayAad(keys.roomId)));
      since = e.seq;
    }
    if (!res.hasMore || res.entries.length === 0) return out;
  }
  throw new Error("Pokój na przekaźniku jest za długi do sprawdzenia");
}

/** Czy stan `doc` zawiera wszystko, co opisuje wektor `sv`. */
function covers(doc: Y.Doc, sv: Uint8Array): boolean {
  const have = Y.decodeStateVector(Y.encodeStateVector(doc));
  for (const [clientId, clock] of Y.decodeStateVector(sv)) {
    if ((have.get(clientId) ?? 0) < clock) return false;
  }
  return true;
}

/**
 * Krok 2: nowy pokój z pełnym stanem dokumentu. Wysyłka idzie zwykłym `RelayProvider` z magazynem
 * nowego pokoju (`store`), więc późniejsze połączenie nowym kodem zaczyna od zapisanego kursora
 * i nie wysyła całości drugi raz. Potem kontrola: pokój pobrany od zera do pomocniczego dokumentu
 * musi zawierać stan sprzed wysyłki. Powtórzenie dokłada tylko to, czego brakuje.
 */
export async function seedRekeyRoom(opts: RekeyRelayOptions, newCode: string, doc: Y.Doc, store: RelayStore): Promise<void> {
  const keys = await keysFor(opts, newCode);
  const wanted = Y.encodeStateVector(doc);
  const provider = new RelayProvider({ baseUrl: opts.baseUrl, keys, doc, store, fetch: opts.fetch, flushMs: 0 });
  let sent: boolean;
  try {
    await provider.start();
    sent = await provider.settle();
  } finally {
    provider.stop();
  }
  if (!sent) throw new Error("Nie udało się wysłać danych do nowego pokoju na przekaźniku");
  const entries = await readRoom(opts, keys);
  const check = new Y.Doc();
  try {
    for (const bytes of entries ?? []) Y.applyUpdate(check, bytes);
    if (!covers(check, wanted)) throw new Error("Nowy pokój na przekaźniku nie zawiera wszystkich danych");
  } finally {
    check.destroy();
  }
}

/** Usuwa pokój; brak pokoju liczy się jak udane usunięcie. */
export async function dropRekeyRoom(opts: RekeyRelayOptions, code: string): Promise<void> {
  const keys = await keysFor(opts, code);
  try {
    await client(opts, keys)("DELETE", "");
  } catch (err) {
    if (!(err instanceof HttpError) || err.status !== 404) throw err;
  }
}

/** Krok 3: jeden wpis (aktualizacja znacznika) wprost do pokoju, bez czekania na kartę prowadzącą przekaźnik. */
export async function postRekeyMarker(opts: RekeyRelayOptions, code: string, update: Uint8Array): Promise<void> {
  const keys = await keysFor(opts, code);
  // Bez `epoch`: wpis ma wejść także wtedy, gdy pokój został w międzyczasie założony od nowa.
  await client(opts, keys)("POST", "/updates", { data: await sealBytes(keys.dataKey, update, relayAad(keys.roomId)) });
}

/**
 * Krok 5: usuwa stary pokój (wpisy i bloby) i zakłada go od nowa z samym znacznikiem — „nagrobek”.
 * Urządzenie wracające po czasie dostaje nową epokę, pobiera znacznik i zatrzymuje się, zanim
 * cokolwiek wyśle. Inne urządzenie może wcisnąć swój stan między usunięciem a wpisem — wtedy
 * powtórka, najwyżej trzy razy. `false` = w pokoju wciąż jest coś poza znacznikiem.
 */
export async function retireRekeyRoom(opts: RekeyRelayOptions, oldCode: string, update: Uint8Array): Promise<boolean> {
  const keys = await keysFor(opts, oldCode);
  const http = client(opts, keys);
  const same = (a: Uint8Array) => a.length === update.length && a.every((b, i) => b === update[i]);
  for (let attempt = 0; attempt < TOMBSTONE_TRIES; attempt++) {
    try {
      await http("DELETE", "");
    } catch (err) {
      if (!(err instanceof HttpError) || err.status !== 404) throw err;
    }
    await http("POST", "/updates", { data: await sealBytes(keys.dataKey, update, relayAad(keys.roomId)) });
    const entries = await readRoom(opts, keys);
    if (entries && entries.length === 1 && same(entries[0])) return true;
  }
  return false;
}
