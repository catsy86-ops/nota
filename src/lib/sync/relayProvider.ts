import * as Y from "yjs";
import { openBytes, relayAad, sealBytes, type RelayKeys } from "@/lib/sync/relayKeys";

/**
 * Przekaźnik E2E po stronie przeglądarki (serwer: `relay-server/`). Zmiany z `Y.Doc`
 * idą jako zaszyfrowane wpisy na serwer, a zmiany innych urządzeń wracają stamtąd,
 * nawet gdy tamto urządzenie jest już wyłączone. Działa równolegle z P2P (`y-webrtc`).
 *
 * Model:
 * - `pending` — aktualizacje lokalne jeszcze niewysłane (trzymane w `RelayStore`, więc
 *   przeżywają zamknięcie karty);
 * - `cursor` — ostatni numer wpisu zastosowany w dokumencie; `since=cursor` pobiera resztę;
 * - kompaktowanie: po 500 wpisach od poprzedniego snapshotu wysyłamy pełny stan dokumentu
 *   jako snapshot z numerem `cursor`. Snapshot zawiera też nasze lokalne, jeszcze
 *   niewysłane zmiany; ich późniejsze wysłanie jest bez skutku (Yjs jest idempotentny).
 *
 * Wszystkie operacje sieciowe idą jedną kolejką (`run`), więc pobieranie, wysyłanie
 * i snapshot się nie przeplatają.
 */

export type RelayStatus = "idle" | "connecting" | "online" | "offline" | "error";

export interface RelayState {
  cursor: number;
  compactedAt: number;
}

/** Trwałość: kolejka i kursor. Implementacja produkcyjna — IndexedDB (`relayRuntime.ts`). */
export interface RelayStore {
  loadPending(): Promise<Uint8Array | null>;
  savePending(bytes: Uint8Array | null): Promise<void>;
  loadState(): Promise<RelayState>;
  saveState(state: RelayState): Promise<void>;
}

export interface RelayOptions {
  /** Adres serwera, np. `https://sync.example.pl`. */
  baseUrl: string;
  keys: RelayKeys;
  doc: Y.Doc;
  store: RelayStore;
  fetch?: typeof fetch;
  /** Gniazdo do powiadomień; bez niego działa na samym pobieraniu i ponawianiu. */
  openSocket?: (url: string) => WebSocket;
  onStatus?: (status: RelayStatus, detail?: string) => void;
  /** Dokument realnie się zmienił po pobraniu (nie tylko echo naszych wpisów). */
  onRemoteChange?: () => void;
  flushMs?: number;
}

export const FLUSH_MS = 1000;
export const COMPACT_AFTER = 500;
/** Ping na gnieździe, gdy karta jest schowana: pośrednicy zamykają bezczynne połączenia. */
export const KEEPALIVE_MS = 20_000;
const RETRY_MIN_MS = 2000;
const RETRY_MAX_MS = 60_000;

/** Kształt odpowiedzi `GET updates` (patrz relay-server/README.md). */
interface Page {
  entries: { seq: number; data: string }[];
  last: number;
  hasMore: boolean;
}

class RelayHttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/** Błąd, po którym ponawianie nie ma sensu (zły kod, uszkodzony wpis). */
class RelayFatalError extends Error {}

export class RelayProvider {
  private readonly origin = { relay: true };
  private readonly aad: string;
  private readonly base: string;
  private readonly fetchFn: typeof fetch;
  private pending: Uint8Array[] = [];
  private state: RelayState = { cursor: 0, compactedAt: 0 };
  private chain: Promise<void> = Promise.resolve();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  private socket: WebSocket | null = null;
  private retryMs = RETRY_MIN_MS;
  private started = false;
  private status: RelayStatus = "idle";

  constructor(private readonly opts: RelayOptions) {
    this.base = opts.baseUrl.replace(/\/+$/, "");
    this.aad = relayAad(opts.keys.roomId);
    this.fetchFn = opts.fetch ?? fetch;
  }

  get cursor(): number {
    return this.state.cursor;
  }

  get currentStatus(): RelayStatus {
    return this.status;
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    const [pending, state] = await Promise.all([this.opts.store.loadPending(), this.opts.store.loadState()]);
    if (pending) this.pending = [pending];
    this.state = state;
    this.setStatus("connecting");
    this.opts.doc.on("update", this.onLocalUpdate);
    this.connectSocket();
    this.sync();
  }

  /**
   * Karta schowana: zapisujemy zaległości od razu i pingujemy gniazdo.
   * Karta wraca: zatrzymujemy ping i nadrabiamy to, co przyszło w międzyczasie.
   */
  setHidden(hidden: boolean): void {
    if (!this.started) return;
    if (hidden) {
      this.flushNow();
      if (!this.keepAliveTimer) {
        this.keepAliveTimer = setInterval(() => {
          if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ type: "ping" }));
        }, KEEPALIVE_MS);
      }
    } else {
      this.stopKeepAlive();
      this.sync();
    }
  }

  private stopKeepAlive(): void {
    if (this.keepAliveTimer) clearInterval(this.keepAliveTimer);
    this.keepAliveTimer = null;
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    this.stopKeepAlive();
    this.opts.doc.off("update", this.onLocalUpdate);
    if (this.flushTimer) clearTimeout(this.flushTimer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.flushTimer = null;
    this.retryTimer = null;
    this.socket?.close();
    this.socket = null;
    this.setStatus("idle");
  }

  /** Pobiera nowe wpisy i wysyła lokalne; wołane po powrocie do karty i po zmianach z gniazda. */
  sync(): void {
    this.run(() => this.pullTask());
    this.run(() => this.flushTask());
  }

  /** Wysyła zaraz, nie czekając na sekundowy debounce (np. przy schowaniu karty). */
  flushNow(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    this.run(() => this.flushTask());
  }

  private readonly onLocalUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === this.origin) return;
    this.pending.push(update);
    void this.persistPending();
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.run(() => this.flushTask());
    }, this.opts.flushMs ?? FLUSH_MS);
  };

  private run(task: () => Promise<void>): void {
    this.chain = this.chain
      .then(task)
      .catch((err: unknown) => this.onError(err));
  }

  private onError(err: unknown): void {
    if (!this.started) return;
    if (err instanceof RelayFatalError) {
      this.setStatus("error", err.message);
      return;
    }
    if (err instanceof RelayHttpError && (err.status === 401 || err.status === 403)) {
      this.setStatus("error", "Serwer nie przyjął kodu synchronizacji");
      return;
    }
    // Sieć, 5xx, 429: ponawiamy z rosnącą przerwą.
    this.setStatus("offline");
    if (this.retryTimer) return;
    const wait = this.retryMs;
    this.retryMs = Math.min(this.retryMs * 2, RETRY_MAX_MS);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.sync();
    }, wait);
  }

  private setStatus(status: RelayStatus, detail?: string): void {
    this.status = status;
    this.opts.onStatus?.(status, detail);
  }

  private async http<T = Record<string, unknown>>(path: string, init: { method: "GET" | "POST" | "PUT"; body?: unknown }): Promise<T> {
    const res = await this.fetchFn(`${this.base}${path}`, {
      method: init.method,
      headers: { Authorization: `Bearer ${this.opts.keys.token}`, "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new RelayHttpError(res.status, typeof json.error === "string" ? json.error : res.statusText);
    return json as T;
  }

  private get roomPath(): string {
    return `/rooms/${this.opts.keys.roomId}`;
  }

  private async persistPending(): Promise<void> {
    const merged = this.pending.length ? Y.mergeUpdates(this.pending) : null;
    await this.opts.store.savePending(merged);
  }

  private async persistState(): Promise<void> {
    await this.opts.store.saveState(this.state);
  }

  private async pullTask(): Promise<void> {
    if (!this.started) return;
    // Yjs emituje `update` tylko przy realnej zmianie dokumentu, więc samo echo naszych wpisów nie liczy się jako zmiana.
    let changed = false;
    const watch = (_u: Uint8Array, origin: unknown) => {
      if (origin === this.origin) changed = true;
    };
    this.opts.doc.on("update", watch);
    try {
      for (;;) {
        const page = await this.http<Page>(`${this.roomPath}/updates?since=${this.state.cursor}`, { method: "GET" });
        for (const entry of page.entries) {
          let bytes: Uint8Array;
          try {
            bytes = await openBytes(this.opts.keys.dataKey, entry.data, this.aad);
          } catch {
            throw new RelayFatalError("Nie udało się odszyfrować wpisu — sprawdź kod synchronizacji");
          }
          Y.applyUpdate(this.opts.doc, bytes, this.origin);
          this.state = { ...this.state, cursor: entry.seq };
        }
        if (!page.hasMore) break;
      }
    } finally {
      this.opts.doc.off("update", watch);
      await this.persistState();
    }
    if (changed) this.opts.onRemoteChange?.();
    this.retryMs = RETRY_MIN_MS;
    this.setStatus("online");
    await this.compactTask();
  }

  private async flushTask(): Promise<void> {
    if (!this.started || this.pending.length === 0) return;
    const parts = this.pending;
    this.pending = [];
    const merged = Y.mergeUpdates(parts);
    let res: { seq: number; last: number };
    try {
      const data = await sealBytes(this.opts.keys.dataKey, merged, this.aad);
      res = await this.http<{ seq: number; last: number }>(`${this.roomPath}/updates`, { method: "POST", body: { data } });
    } catch (err) {
      // Wysłanie się nie udało: wracamy z tym, co zebraliśmy, przed to, co doszło w międzyczasie.
      this.pending = [...parts, ...this.pending];
      await this.persistPending();
      throw err;
    }
    await this.persistPending();
    // Jeśli nasz wpis dostał numer zaraz za kursorem, dokument już go zawiera — nie trzeba go pobierać.
    if (res.seq === this.state.cursor + 1) {
      this.state = { ...this.state, cursor: res.seq };
      await this.persistState();
    }
    this.retryMs = RETRY_MIN_MS;
    this.setStatus("online");
    await this.compactTask();
  }

  private async compactTask(): Promise<void> {
    if (!this.started || this.state.cursor < 1) return;
    if (this.state.cursor - this.state.compactedAt < COMPACT_AFTER) return;
    const upto = this.state.cursor;
    const data = await sealBytes(this.opts.keys.dataKey, Y.encodeStateAsUpdate(this.opts.doc), this.aad);
    await this.http(`${this.roomPath}/snapshot`, { method: "PUT", body: { upto, data } });
    this.state = { ...this.state, compactedAt: upto };
    await this.persistState();
  }

  private connectSocket(): void {
    if (!this.started || !this.opts.openSocket) return;
    const url = `${this.base.replace(/^http/, "ws")}/ws`;
    const ws = this.opts.openSocket(url);
    this.socket = ws;
    ws.onopen = () => ws.send(JSON.stringify({ type: "subscribe", room: this.opts.keys.roomId, token: this.opts.keys.token }));
    ws.onmessage = (ev: MessageEvent) => {
      let msg: { type?: string; last?: number };
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (msg.type === "ready") {
        this.retryMs = RETRY_MIN_MS;
        this.sync(); // po (re)połączeniu nadrabiamy to, co przyszło, gdy gniazda nie było
      } else if (msg.type === "updated" && typeof msg.last === "number" && msg.last > this.state.cursor) {
        this.run(() => this.pullTask());
      }
    };
    ws.onclose = () => {
      this.socket = null;
      if (!this.started) return;
      this.setStatus("offline");
      if (this.retryTimer) return;
      const wait = this.retryMs;
      this.retryMs = Math.min(this.retryMs * 2, RETRY_MAX_MS);
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        this.connectSocket();
      }, wait);
    };
  }
}
