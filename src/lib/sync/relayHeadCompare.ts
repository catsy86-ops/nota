/**
 * Drugi kanał wykrywania cofnięcia i cenzury przekaźnika (S2.3, `docs/plan-wiadomosci-i-cofniecia.md` §2.3).
 * Urządzenia, które widzą się bezpośrednio, rozgłaszają w awareness głowę pokoju, jaką ostatnio podał im
 * przekaźnik: `relay: { epoch, last, u }` (`u` — skrót adresu serwera, porównujemy tylko ten sam serwer).
 *
 * Deklaracja sąsiada jest niezaufana — skutkiem jest wyłącznie ostrzeżenie `split`, nigdy zmiana danych.
 */

export interface PeerRelayHead {
  epoch: string;
  last: number;
  u: string;
}

export interface OwnRelayHead {
  epoch?: string;
  last: number;
  pulledAt: number;
  u: string;
}

/** Strona serwera (`LIMITS.PAGE` w `relay-server/core.js`): różnica w obrębie strony to zwykłe opóźnienie. */
export const HEAD_PAGE = 500;
/** Jak długo rozjazd musi trwać i jak świeże musi być nasze pobranie. */
export const HEAD_GRACE_MS = 60_000;

const EPOCH_RE = /^[0-9a-f]{32}$/;
const URL_TAG_RE = /^[0-9a-f]{8}$/;

/** Czyści deklarację sąsiada; nieprawidłowa = brak. */
export function cleanPeerHead(raw: unknown): PeerRelayHead | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.epoch !== "string" || !EPOCH_RE.test(r.epoch)) return null;
  if (typeof r.u !== "string" || !URL_TAG_RE.test(r.u)) return null;
  if (typeof r.last !== "number" || !Number.isSafeInteger(r.last) || r.last < 0) return null;
  return { epoch: r.epoch, last: r.last, u: r.u };
}

/** Krótki skrót adresu serwera (FNV-1a, 8 znaków szesnastkowych) — sam adres nie idzie do sąsiadów. */
export function relayUrlTag(url: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < url.length; i++) {
    h ^= url.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function mismatch(peer: PeerRelayHead, own: OwnRelayHead): boolean {
  if (!own.epoch) return false;
  if (peer.epoch !== own.epoch) return true;
  return peer.last - own.last > HEAD_PAGE;
}

/**
 * Śledzi rozjazd na sąsiada. `split` dopiero gdy rozjazd trwa ponad `HEAD_GRACE_MS` i nasze pobranie wykonane
 * już po jego zauważeniu go nie usunęło (zwykłe opóźnienie gniazda znika przy następnym pobraniu).
 */
export class RelayHeadCompare {
  private since = new Map<number, number>();

  /** Zwraca `true`, gdy trzeba podnieść ostrzeżenie (raz na rozjazd danego sąsiada). */
  observe(peerId: number, rawPeer: unknown, own: OwnRelayHead | null, now: number): boolean {
    const peer = cleanPeerHead(rawPeer);
    // Porównanie tylko przy świeżym własnym pobraniu i tym samym serwerze.
    if (!peer || !own || peer.u !== own.u || now - own.pulledAt >= HEAD_GRACE_MS || !mismatch(peer, own)) {
      this.since.delete(peerId);
      return false;
    }
    const since = this.since.get(peerId);
    if (since === undefined) {
      this.since.set(peerId, now);
      return false;
    }
    if (since === -1) return false; // już zgłoszone
    if (now - since > HEAD_GRACE_MS && own.pulledAt > since) {
      this.since.set(peerId, -1);
      return true;
    }
    return false;
  }

  /** Sąsiedzi, których już nie ma, nie trzymają stanu. */
  retain(ids: Iterable<number>): void {
    const keep = new Set(ids);
    for (const id of this.since.keys()) if (!keep.has(id)) this.since.delete(id);
  }

  reset(): void {
    this.since.clear();
  }
}
