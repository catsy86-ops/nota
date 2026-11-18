import { logDiag } from "@/lib/diagnostics";
import { classify, newGuardState, type GuardLimits } from "@/lib/sync/peerGuard";

/**
 * Dzielenie dużych wiadomości kanału danych WebRTC (D-U1, U-1 z `docs/plan-wiadomosci-i-cofniecia.md` §1.7).
 *
 * Chrome przyjmuje w jednej wiadomości najwyżej 256 KiB (`max-message-size`); `simple-peer` nie dzieli, a `y-webrtc`
 * połyka błąd wysyłki — pełna wymiana większego dokumentu i pierwsza wymiana obrazów po cichu nie dochodziły.
 * Wiadomość powyżej `CHUNK_FROM` idzie jako ramki po `CHUNK_SIZE`; mniejsze bez zmian, więc ze starszą wersją aplikacji
 * małe wiadomości działają jak dotąd. Starsza wersja ramek nie rozumie: `y-webrtc` dla nieznanego typu wiadomości
 * nic nie robi (typ 100 > typów 0–4), a te wiadomości i tak by do niej nie doszły.
 *
 * Ramka: `[100, 1, id(4), index(4), total(4), payload]` — 100 to typ (varuint, jeden bajt), 1 to wersja formatu.
 */

export const CHUNK_TYPE = 100;
const CHUNK_V = 1;
const HEADER = 14;
export const CHUNK_SIZE = 64 * 1024;
/** Od tylu bajtów wiadomość jest dzielona (zapas pod limitem 256 KiB). */
export const CHUNK_FROM = 192 * 1024;
/** Bufor kanału, powyżej którego wysyłka czeka (Chrome zamyka kanał przy przepełnieniu 16 MiB). */
const BUFFER_HIGH = 1024 * 1024;
const ASSEMBLY_TIMEOUT_MS = 60_000;
const MAX_ASSEMBLIES = 4;

export function isChunkFrame(b: Uint8Array): boolean {
  return b.length >= HEADER && b[0] === CHUNK_TYPE && b[1] === CHUNK_V;
}

/** Ramki jednej wiadomości. `id` — losowy identyfikator wiadomości (32 bity). */
export function encodeChunks(msg: Uint8Array, id: number, size = CHUNK_SIZE): Uint8Array[] {
  const total = Math.max(1, Math.ceil(msg.length / size));
  const out: Uint8Array[] = [];
  for (let i = 0; i < total; i++) {
    const part = msg.subarray(i * size, Math.min(msg.length, (i + 1) * size));
    const f = new Uint8Array(HEADER + part.length);
    const v = new DataView(f.buffer);
    f[0] = CHUNK_TYPE;
    f[1] = CHUNK_V;
    v.setUint32(2, id >>> 0);
    v.setUint32(6, i);
    v.setUint32(10, total);
    f.set(part, HEADER);
    out.push(f);
  }
  return out;
}

export interface AssemblerLimits {
  /** Największa złożona wiadomość (bajty); większa → `close`. */
  maxBytes: number;
  now?: () => number;
}

export type AssembleResult = { kind: "pass"; data: Uint8Array } | { kind: "wait" } | { kind: "close"; reason: string };

/**
 * Składanie ramek jednego połączenia. Zwraca `pass` ze zwykłą albo złożoną wiadomością, `wait` dla ramki w trakcie,
 * `close` dla danych, których nie wolno przyjąć (za duża, sprzeczne nagłówki, za dużo naraz). Wiadomości synchronizacji
 * nie wolno pominąć (§1.2), więc każdy błąd ramki zamyka połączenie zamiast gubić część.
 */
export function createAssembler({ maxBytes, now = Date.now }: AssemblerLimits) {
  const open = new Map<number, { total: number; parts: (Uint8Array | undefined)[]; got: number; bytes: number; started: number }>();
  return function push(b: Uint8Array): AssembleResult {
    if (!isChunkFrame(b)) return { kind: "pass", data: b };
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    const id = v.getUint32(2);
    const index = v.getUint32(6);
    const total = v.getUint32(10);
    const t = now();
    for (const [k, a] of open) if (t - a.started > ASSEMBLY_TIMEOUT_MS) open.delete(k);
    if (total < 1 || index >= total || total * CHUNK_SIZE > maxBytes + CHUNK_SIZE) return { kind: "close", reason: `ramki: ${total}` };
    let a = open.get(id);
    if (!a) {
      if (open.size >= MAX_ASSEMBLIES) return { kind: "close", reason: "za dużo składanych wiadomości" };
      a = { total, parts: new Array(total), got: 0, bytes: 0, started: t };
      open.set(id, a);
    }
    if (a.total !== total) { open.delete(id); return { kind: "close", reason: "sprzeczne nagłówki" }; }
    if (a.parts[index]) return { kind: "wait" };
    const part = b.slice(HEADER);
    a.parts[index] = part;
    a.got++;
    a.bytes += part.length;
    if (a.bytes > maxBytes) { open.delete(id); return { kind: "close", reason: `rozmiar > ${maxBytes}` }; }
    if (a.got < a.total) return { kind: "wait" };
    open.delete(id);
    const out = new Uint8Array(a.bytes);
    let off = 0;
    for (const p of a.parts) { out.set(p!, off); off += p!.length; }
    return { kind: "pass", data: out };
  };
}

/** Kształt `simple-peer` używany przez `y-webrtc` (tylko to, czego dotykamy). */
export interface PeerLike {
  send(data: Uint8Array): void;
  listeners(event: "data"): ((data: Uint8Array) => void)[];
  removeAllListeners(event: "data"): unknown;
  on(event: "data", fn: (data: Uint8Array) => void): unknown;
  destroy(err?: Error): void;
  destroyed?: boolean;
  _channel?: { bufferedAmount: number } | null;
  __chunked?: true;
}

const waitBuffer = (peer: PeerLike) => new Promise<void>((resolve) => {
  const tick = () => (peer.destroyed || !peer._channel || peer._channel.bufferedAmount < BUFFER_HIGH ? resolve() : setTimeout(tick, 20));
  tick();
});

/** Strażnik połączenia (Z-15.5): limity wiadomości i reakcje wołającego. */
export interface PeerGuardHooks {
  limits: GuardLimits;
  /** Połączenie zamknięte przez strażnika (wpis bezpieczeństwa, licznik grupy). */
  onClose(reason: string): void;
  /** Po przepuszczonym awareness: `true` zamyka połączenie (np. ponad 64 stany). */
  afterAwareness?(): boolean;
}

/**
 * Owija `send` i odbiór `data` połączenia. Duże wiadomości idą ramkami w kolejce z kontrolą bufora kanału; gdy
 * kolejka nie jest pusta, małe wiadomości czekają za nią (kolejność zostaje). `false` — kształt obiektu inny niż
 * oczekiwany (aktualizacja biblioteki): wołający zamyka połączenie.
 */
export function attachChunking(peer: PeerLike, limits: AssemblerLimits, label: string, guard?: PeerGuardHooks): boolean {
  if (peer.__chunked) return true;
  if (typeof peer.send !== "function" || typeof peer.listeners !== "function" || typeof peer.removeAllListeners !== "function") return false;
  const original = peer.listeners("data");
  if (original.length !== 1) return false;
  const rawSend = peer.send.bind(peer);
  const queue: Uint8Array[] = [];
  let pumping = false;
  const pump = async () => {
    if (pumping) return;
    pumping = true;
    try {
      while (queue.length > 0 && !peer.destroyed) {
        if (peer._channel && peer._channel.bufferedAmount >= BUFFER_HIGH) await waitBuffer(peer);
        if (peer.destroyed) break;
        rawSend(queue.shift()!);
      }
    } catch (err) {
      logDiag("warn", "peerChunks", `${label}: wysyłka przerwana`, err);
      queue.length = 0;
      peer.destroy();
    } finally {
      pumping = false;
    }
  };
  peer.send = (data: Uint8Array) => {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data as ArrayBuffer);
    if (bytes.length < CHUNK_FROM && queue.length === 0 && !pumping) { rawSend(bytes); return; }
    if (bytes.length < CHUNK_FROM) queue.push(bytes);
    else queue.push(...encodeChunks(bytes, crypto.getRandomValues(new Uint32Array(1))[0]));
    void pump();
  };
  const push = createAssembler(limits);
  const guardState = newGuardState();
  const close = (reason: string) => {
    if (peer.destroyed) return;
    logDiag("warn", "peerChunks", `${label}: zamknięte połączenie (${reason})`);
    guard?.onClose(reason);
    peer.destroy();
  };
  peer.removeAllListeners("data");
  peer.on("data", (data: Uint8Array) => {
    if (peer.destroyed) return;
    const res = push(data instanceof Uint8Array ? data : new Uint8Array(data as ArrayBuffer));
    if (res.kind === "close") { close(res.reason); return; }
    if (res.kind !== "pass") return;
    if (guard) {
      const v = classify(res.data, guardState, guard.limits, Date.now());
      if (v.kind === "close") { close(v.reason); return; }
      if (v.kind === "drop") return;
    }
    try {
      for (const l of original) l(res.data);
      if (guard?.afterAwareness && res.data[0] === 1 && guard.afterAwareness()) close("awareness: za dużo stanów");
    } catch (err) {
      // Poprawny nagłówek, zepsuta treść: dekodowanie Yjs rzuca — liczy się jak naruszenie, nie ginie po cichu.
      logDiag("warn", "peerChunks", `${label}: błąd przy nakładaniu wiadomości`, err);
      close("błąd dekodowania");
    }
  });
  peer.__chunked = true;
  return true;
}

/** Kształt pokoju `y-webrtc` (wnętrze biblioteki — wersja przypięta, kształt pilnuje test-kanarek). */
interface ProviderLike {
  room: { webrtcConns: Map<string, { peer: PeerLike }> } | null;
  on(event: "peers", fn: (e: { added: string[] }) => void): void;
}

/** Zakłada dzielenie na każdym nowym połączeniu dostawcy. Połączenie o nieznanym kształcie jest zamykane. */
export function chunkProvider(p: ProviderLike, limits: AssemblerLimits, label: string, guard?: PeerGuardHooks): void {
  p.on("peers", ({ added }) => {
    for (const id of added ?? []) {
      const conn = p.room?.webrtcConns.get(id);
      if (!conn?.peer) continue;
      if (!attachChunking(conn.peer, limits, label, guard)) {
        logDiag("error", "peerChunks", `${label}: nieznany kształt połączenia — zamknięte`);
        conn.peer.destroy();
      }
    }
  });
}
