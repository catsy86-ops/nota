import * as Y from "yjs";
import { openBytes, relayAad, sealBytes, type RelayKeys } from "@/lib/sync/relayKeys";
import { endpointFetch } from "@/lib/net/endpoints";

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
 *   niewysłane zmiany; ich późniejsze wysłanie jest bez skutku (Yjs jest idempotentny);
 * - `epoch` — znacznik pokoju nadany przez serwer przy założeniu. Pokój usunięty i założony od nowa
 *   (albo odtworzony po utracie danych serwera) ma inną epokę i numery od 1, więc kursor i `sv`
 *   przestają cokolwiek znaczyć. Wtedy robimy reset (`resetRoom`): kursor na zero i pełny stan
 *   dokumentu do wysłania. Bez tego nowe urządzenie dostałoby samą różnicę bez poprzedników, a my
 *   nie widzielibyśmy wpisów o numerach niższych niż stary kursor. Ponowne wysłanie pełnego stanu
 *   jest w Yjs bez skutku, więc zbędny reset kosztuje tylko transfer.
 *
 * Wszystkie operacje sieciowe idą jedną kolejką (`run`), więc pobieranie, wysyłanie
 * i snapshot się nie przeplatają.
 */

export type RelayStatus = "idle" | "connecting" | "online" | "offline" | "error";
/** Kod trwałego błędu — UI rozpoznaje po nim przypadek, nie po tekście `detail`. */
export type RelayErrorCode = "ROOM_FULL";

export interface RelayState {
  cursor: number;
  compactedAt: number;
  /** Wektor stanu z ostatniego udanego wysłania: od niego liczymy, co wysłać przy starcie. */
  sv?: Uint8Array;
  /** Epoka pokoju, której dotyczą `cursor`, `compactedAt` i `sv`; brak = stan sprzed epok albo po resecie. */
  epoch?: string;
  /** Czasy ostatnich resetów pokoju (najwyżej `RESET_KEEP`), do wykrycia pętli resetów (S2.3, wiersz 3). */
  resets?: number[];
  /** Aktywne ostrzeżenie o stanie serwera i chwila ostatniego zdarzenia; gaśnie po `WARNING_TTL_MS` albo po „Rozumiem”. */
  warning?: RelayWarning;
  warnedAt?: number;
}

/**
 * Ostrzeżenie o serwerze (S2.3, `docs/plan-wiadomosci-i-cofniecia.md` §2.2):
 * - `rollback` — ta sama epoka, a serwer ma mniej wpisów, niż już pobraliśmy;
 * - `reset-loop` — trzy resety jednego pokoju w ciągu doby;
 * - `split` — urządzenie obok trwale widzi inną głowę pokoju (porównanie przez awareness, `relayRuntime.ts`).
 */
export type RelayWarning = "rollback" | "reset-loop" | "split";

/** Głowa pokoju, jaką ostatnio podał serwer, i chwila ostatniego udanego pobrania. */
export interface RelayHead {
  epoch?: string;
  last: number;
  pulledAt: number;
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
  onStatus?: (status: RelayStatus, detail?: string, code?: RelayErrorCode) => void;
  /** Dokument realnie się zmienił po pobraniu (nie tylko echo naszych wpisów). */
  onRemoteChange?: () => void;
  flushMs?: number;
  /**
   * Czy wolno wysyłać dane użytkownika (wpisy, migawki). `false` zatrzymuje wysyłkę bez gubienia
   * kolejki — pobieranie działa dalej. Pytane tuż przed każdym żądaniem, bo odpowiedź może się
   * zmienić w trakcie pobierania (znacznik „kod zmieniony” przychodzi jako zwykły wpis).
   */
  canSend?: () => boolean;
  /** Nowe zdarzenie ostrzegawcze (do dziennika bezpieczeństwa); stan ostrzeżenia czyta się z `warning`. */
  onWarning?: (kind: RelayWarning, detail: string) => void;
  /** Serwer podał głowę pokoju (po pobraniu). */
  onHead?: (head: RelayHead) => void;
  now?: () => number;
  /** Limit czasu jednego żądania (ms); domyślnie `REQUEST_TIMEOUT_MS`. */
  requestTimeoutMs?: number;
}

export const FLUSH_MS = 1000;
export const COMPACT_AFTER = 500;
/** Ping na gnieździe, gdy karta jest schowana: pośrednicy zamykają bezczynne połączenia. */
export const KEEPALIVE_MS = 20_000;
/**
 * Żądanie bez odpowiedzi (serwer albo pośrednik zawiesił połączenie) blokowałoby łańcuch zadań na zawsze —
 * po tym czasie traktujemy je jak błąd sieci i ponawiamy (Z-5.T).
 */
export const REQUEST_TIMEOUT_MS = 30_000;
/** Limit wpisu serwera (`relay-server/core.js` `MAX_ENTRY_CHARS`, ~16 MB po odkodowaniu). */
export const MAX_ENTRY_CHARS = 22_400_000;
const TOO_BIG = "Dane są za duże dla przekaźnika (limit 16 MB na wpis)";
const ROOM_FULL = "Pokój na przekaźniku jest pełny — migawka nie zwolniła miejsca";
const RETRY_MIN_MS = 2000;
/** Górny limit stron w jednym pobraniu; reszta idzie przy następnym (kursor jest zapisany). */
const MAX_PULL_PAGES = 1000;
const RETRY_MAX_MS = 60_000;
const PERSIST_MS = 500;
export const RESET_KEEP = 5;
export const RESET_WINDOW_MS = 24 * 60 * 60 * 1000;
export const RESET_LOOP_COUNT = 3;
export const WARNING_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Kształt odpowiedzi `GET updates` (patrz relay-server/README.md). */
interface Page {
  entries: { seq: number; data: string }[];
  last: number;
  hasMore: boolean;
  /** Brak na serwerze sprzed epok. */
  epoch?: string;
}

/** Odpowiedź zapisu (`POST updates`, `PUT snapshot`). */
interface Written {
  seq: number;
  last: number;
  epoch?: string;
}

const epochOf = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);

class RelayHttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/** Błąd, po którym ponawianie nie ma sensu (zły kod, uszkodzony wpis). */
class RelayFatalError extends Error {
  constructor(message: string, readonly code?: RelayErrorCode) {
    super(message);
  }
}

export class RelayProvider {
  private readonly origin = { relay: true };
  private readonly aad: string;
  private readonly base: string;
  private readonly fetchFn: typeof fetch;
  private pending: Uint8Array[] = [];
  private state: RelayState = { cursor: 0, compactedAt: 0 };
  private chain: Promise<void> = Promise.resolve();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private persistChain: Promise<void> = Promise.resolve();
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  private socket: WebSocket | null = null;
  private retryMs = RETRY_MIN_MS;
  private started = false;
  private status: RelayStatus = "idle";
  private headSeen: RelayHead | null = null;

  constructor(private readonly opts: RelayOptions) {
    this.base = opts.baseUrl.replace(/\/+$/, "");
    this.aad = relayAad(opts.keys.roomId);
    this.fetchFn = opts.fetch ?? endpointFetch; // S1.2: tylko adresy dozwolone przez lib/net/endpoints
  }

  get cursor(): number {
    return this.state.cursor;
  }

  get currentStatus(): RelayStatus {
    return this.status;
  }

  /** Aktywne ostrzeżenie; po `WARNING_TTL_MS` od ostatniego zdarzenia gaśnie samo. */
  get warning(): RelayWarning | null {
    const { warning, warnedAt } = this.state;
    if (!warning || warnedAt === undefined || this.now() - warnedAt > WARNING_TTL_MS) return null;
    return warning;
  }

  get head(): RelayHead | null {
    return this.headSeen;
  }

  /** „Rozumiem”: zdejmuje ostrzeżenie (licznik resetów zostaje). */
  async acknowledgeWarning(): Promise<void> {
    if (!this.state.warning) return;
    const { warning: _w, warnedAt: _a, ...rest } = this.state;
    this.state = rest;
    await this.persistState();
  }

  /** Ostrzeżenie z zewnątrz (`split` z porównania awareness). */
  async raiseWarning(kind: RelayWarning, detail: string): Promise<void> {
    this.state = { ...this.state, warning: kind, warnedAt: this.now() };
    this.opts.onWarning?.(kind, detail);
    await this.persistState();
  }

  private now(): number {
    return this.opts.now?.() ?? Date.now();
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    const [pending, state] = await Promise.all([this.opts.store.loadPending(), this.opts.store.loadState()]);
    if (!this.started) return; // stop() w trakcie wczytywania: nie podłączamy niczego
    if (pending) this.pending = [pending];
    this.state = state;
    // Zmiany sprzed startu nie przeszły przez nasłuch `update`: dokładamy różnicę względem `sv`.
    // Pusta różnica to dwa bajty (`[0,0]`) i jej nie wysyłamy.
    const initial = Y.encodeStateAsUpdate(this.opts.doc, this.state.sv);
    if (initial.length > 2) this.pending.push(initial);
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
          // 1 = WebSocket.OPEN; stała zamiast globalnego WebSocket (reguła S1.2), a gniazda testowe nie mają pola OPEN
          if (this.socket?.readyState === 1) this.socket.send(JSON.stringify({ type: "ping" }));
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
    if (this.persistTimer) void this.persistPending(); // zaległy zapis nie może zginąć ze stopem
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
    void this.persistPending();
    this.run(() => this.flushTask());
  }

  /**
   * Wysyła zaległości i czeka, aż kolejka zadań się opróżni. `true` = serwer potwierdził wszystko
   * i nic nie czeka na wysłanie. Dla operacji jednorazowych (zasilenie nowego pokoju przy wymianie
   * kodu), nie dla zwykłej pracy — tam stan niesie `onStatus`.
   */
  async settle(): Promise<boolean> {
    this.flushNow();
    let seen: Promise<void>;
    do {
      seen = this.chain;
      await seen;
    } while (seen !== this.chain);
    return this.started && this.status === "online" && this.pending.length === 0;
  }

  private readonly onLocalUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === this.origin) return;
    this.pending.push(update);
    this.schedulePersist();
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
      this.setStatus("error", err.message, err.code);
      return;
    }
    if (err instanceof RelayHttpError && (err.status === 401 || err.status === 403)) {
      this.setStatus("error", "Serwer nie przyjął kodu synchronizacji");
      return;
    }
    if (err instanceof RelayHttpError && err.status === 413) {
      this.setStatus("error", TOO_BIG);
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

  private setStatus(status: RelayStatus, detail?: string, code?: RelayErrorCode): void {
    this.status = status;
    this.opts.onStatus?.(status, detail, code);
  }

  private async http<T = Record<string, unknown>>(path: string, init: { method: "GET" | "POST" | "PUT"; body?: unknown }): Promise<T> {
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Wyścig, nie samo `signal`: atrapy i stare silniki potrafią zignorować przerwanie.
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        ctrl.abort();
        reject(new TypeError("Przekaźnik nie odpowiedział w czasie"));
      }, this.opts.requestTimeoutMs ?? REQUEST_TIMEOUT_MS);
    });
    try {
      return await Promise.race([this.request<T>(path, init, ctrl.signal), timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  private async request<T>(path: string, init: { method: "GET" | "POST" | "PUT"; body?: unknown }, signal: AbortSignal): Promise<T> {
    const res = await this.fetchFn(`${this.base}${path}`, {
      method: init.method,
      headers: { Authorization: `Bearer ${this.opts.keys.token}`, "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      signal,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new RelayHttpError(res.status, typeof json.error === "string" ? json.error : res.statusText);
    return json as T;
  }

  private get roomPath(): string {
    return `/rooms/${this.opts.keys.roomId}`;
  }

  /** Zapis zaległości z opóźnieniem: seria szybkich zmian to jeden zapis, nie jeden na każdy znak. */
  private schedulePersist(): void {
    if (this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void this.persistPending();
    }, PERSIST_MS);
  }

  /** Zapis natychmiast, jedną kolejką (zapisy nie wyprzedzają się); `pending` zwija się do jednego elementu. */
  private persistPending(): Promise<void> {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = null;
    const task = async () => {
      if (this.pending.length > 1) this.pending = [Y.mergeUpdates(this.pending)];
      await this.opts.store.savePending(this.pending[0] ?? null);
    };
    const next = this.persistChain.then(task, task);
    this.persistChain = next.catch(() => undefined);
    return next;
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
      // Serwer, który ciągle zgłasza `hasMore` z pustą stroną, nie może zapętlić klienta.
      for (let pages = 0; pages < MAX_PULL_PAGES; pages++) {
        let page: Page;
        try {
          page = await this.http<Page>(`${this.roomPath}/updates?since=${this.state.cursor}`, { method: "GET" });
        } catch (err) {
          if (!(err instanceof RelayHttpError) || err.status !== 404) throw err;
          // Pokoju nie ma. Jeśli coś o nim pamiętamy, to zniknął — pełny stan pójdzie przy wysyłce,
          // która założy go od nowa. Jeśli nie, to po prostu nikt jeszcze nic nie zapisał.
          if (this.knowsRoom()) await this.resetRoom(undefined);
          break;
        }
        if (!page || !Array.isArray(page.entries)) throw new RelayFatalError("Serwer przekaźnika zwrócił nieprawidłową odpowiedź");
        const epoch = epochOf(page.epoch);
        if (this.roomReplaced(epoch, page.last)) {
          // Strona była liczona od starego kursora — po resecie pobieramy od zera. Po resecie epoki są
          // równe, więc drugi raz tu nie wejdziemy.
          await this.resetRoom(epoch);
          continue;
        }
        if (this.rolledBack(epoch, page.last)) {
          await this.onRollback(page.last);
          continue;
        }
        if (epoch && this.state.epoch !== epoch) this.state = { ...this.state, epoch };
        this.headSeen = { epoch: epoch ?? this.state.epoch, last: page.last, pulledAt: this.now() };
        for (const entry of page.entries) {
          if (!entry || typeof entry.data !== "string" || typeof entry.seq !== "number" || !(entry.seq > this.state.cursor)) {
            throw new RelayFatalError("Serwer przekaźnika zwrócił nieprawidłowy wpis");
          }
          let bytes: Uint8Array;
          try {
            bytes = await openBytes(this.opts.keys.dataKey, entry.data, this.aad);
          } catch {
            throw new RelayFatalError("Nie udało się odszyfrować wpisu — sprawdź kod synchronizacji");
          }
          try {
            Y.applyUpdate(this.opts.doc, bytes, this.origin);
          } catch {
            throw new RelayFatalError("Wpis z przekaźnika jest uszkodzony i nie da się go zastosować");
          }
          this.state = { ...this.state, cursor: entry.seq };
        }
        if (!page.hasMore || page.entries.length === 0) break;
      }
    } finally {
      this.opts.doc.off("update", watch);
      await this.persistState();
    }
    if (this.headSeen) this.opts.onHead?.(this.headSeen);
    if (changed) this.opts.onRemoteChange?.();
    this.retryMs = RETRY_MIN_MS;
    this.setStatus("online");
    await this.compactTask();
  }

  private async flushTask(): Promise<void> {
    if (!this.started || this.pending.length === 0 || !this.maySend()) return;
    const sv = Y.encodeStateVector(this.opts.doc);
    const parts = this.pending;
    this.pending = [];
    const merged = Y.mergeUpdates(parts);
    let res: Written | undefined;
    for (let attempt = 0; !res; attempt++) {
      try {
        const data = await sealBytes(this.opts.keys.dataKey, merged, this.aad);
        // Serwer zerwie połączenie przy za dużym ciele, zanim odpowie 413 — bez tej kontroli ponawialibyśmy bez końca.
        if (data.length > MAX_ENTRY_CHARS) throw new RelayFatalError(TOO_BIG);
        if (!this.maySend()) {
          this.pending = [...parts, ...this.pending];
          await this.persistPending();
          return;
        }
        res = await this.http<Written>(`${this.roomPath}/updates`, { method: "POST", body: { data, epoch: this.state.epoch } });
      } catch (err) {
        // 412: pokój ma inną epokę albo go nie ma — serwer nie przyjął różnicy. Pełny stan zastępuje
        // to, co właśnie próbowaliśmy wysłać (`parts` są jego częścią).
        if (err instanceof RelayHttpError && err.status === 412) {
          await this.resetRoom(undefined);
          return;
        }
        // Log pełny (409): jedna próba migawki mimo progu i ponowienie wysyłki.
        if (attempt === 0 && err instanceof RelayHttpError && err.status === 409) {
          try {
            await this.compactTask(true);
            continue;
          } catch {
            // migawka się nie udała — wracamy z pierwotnym błędem
          }
        }
        // 409 po udanej migawce: pokój nie mieści nawet pełnego stanu — ponawianie nic nie da.
        const fatal = attempt > 0 && err instanceof RelayHttpError && err.status === 409 ? new RelayFatalError(ROOM_FULL, "ROOM_FULL") : err;
        // Wysłanie się nie udało: wracamy z tym, co zebraliśmy, przed to, co doszło w międzyczasie.
        this.pending = [...parts, ...this.pending];
        await this.persistPending();
        throw fatal;
      }
    }
    await this.persistPending();
    // Serwer sprzed epok (albo nasz stan sprzed epok): odtworzony pokój poznajemy po numerze, który
    // nie wyprzedza kursora. Wysłana różnica zostaje na serwerze — Yjs odłoży ją u odbiorców do czasu,
    // aż dotrze pełny stan.
    const epoch = epochOf(res.epoch);
    if (this.roomReplaced(epoch, res.seq - 1)) {
      await this.resetRoom(epoch);
      return;
    }
    if (this.rolledBack(epoch, res.seq - 1)) {
      await this.onRollback(res.seq - 1);
      return;
    }
    if (epoch && this.state.epoch !== epoch) this.state = { ...this.state, epoch };
    // Jeśli nasz wpis dostał numer zaraz za kursorem, dokument już go zawiera — nie trzeba go pobierać.
    const cursor = res.seq === this.state.cursor + 1 ? res.seq : this.state.cursor;
    this.state = { ...this.state, cursor, sv };
    await this.persistState();
    this.retryMs = RETRY_MIN_MS;
    this.setStatus("online");
    await this.compactTask();
  }

  private async compactTask(force = false): Promise<void> {
    if (!this.started || this.state.cursor < 1 || !this.maySend()) return;
    if (!force && this.state.cursor - this.state.compactedAt < COMPACT_AFTER) return;
    const upto = this.state.cursor;
    const data = await sealBytes(this.opts.keys.dataKey, Y.encodeStateAsUpdate(this.opts.doc), this.aad);
    if (!this.maySend()) return;
    try {
      await this.http(`${this.roomPath}/snapshot`, { method: "PUT", body: { upto, data, epoch: this.state.epoch } });
    } catch (err) {
      // Pokój zniknął (404) albo ma inną epokę (412) między pobraniem a migawką.
      if (err instanceof RelayHttpError && (err.status === 412 || err.status === 404)) {
        await this.resetRoom(undefined);
        return;
      }
      throw err;
    }
    this.state = { ...this.state, compactedAt: upto };
    await this.persistState();
  }

  private maySend(): boolean {
    return this.opts.canSend?.() ?? true;
  }

  /** Czy mamy stan dotyczący jakiegoś pokoju na serwerze (pobrane albo wysłane wpisy). */
  private knowsRoom(): boolean {
    return this.state.cursor > 0 || this.state.sv !== undefined || this.state.epoch !== undefined;
  }

  /**
   * Czy pokój na serwerze to inny pokój niż ten, którego dotyczy nasz stan. `last` — najwyższy numer
   * wpisu w pokoju, nie licząc wpisu dopisanego właśnie przez nas.
   * - obie strony znają epokę: decyduje porównanie;
   * - nasz stan jest sprzed epok albo serwer ich nie zna: zostaje numeracja — pokój, w którym jest
   *   mniej wpisów, niż już pobraliśmy, został założony od nowa. To nie wykryje pokoju, który zdążył
   *   dogonić stary kursor; dlatego serwer nadaje epoki.
   */
  private roomReplaced(epoch: string | undefined, last: number): boolean {
    if (epoch && this.state.epoch) return epoch !== this.state.epoch;
    return typeof last === "number" && last < this.state.cursor;
  }

  /**
   * Cofnięcie (S2.3, wiersz 4): ta sama epoka, a serwer ma mniej wpisów, niż już pobraliśmy — odtworzony z kopii
   * bez nowej epoki albo celowe działanie operatora. Liczba wpisów nie jest tu sygnałem (migawka ją zmniejsza,
   * ale numery rosną dalej); decyduje tylko `last` poniżej kursora.
   */
  private rolledBack(epoch: string | undefined, last: number): boolean {
    return !!epoch && epoch === this.state.epoch && typeof last === "number" && last < this.state.cursor;
  }

  /** Reakcja na cofnięcie: ostrzeżenie, potem jak przy resecie — pełny stan naprawia serwer treścią z urządzenia. */
  private async onRollback(last: number): Promise<void> {
    const detail = `last ${last} < kursor ${this.state.cursor}`;
    this.state = { ...this.state, warning: "rollback", warnedAt: this.now() };
    this.opts.onWarning?.("rollback", detail);
    await this.resetRoom(this.state.epoch, false);
  }

  /**
   * Zaczyna pokój od zera: kursor i `sv` znikają, a do wysłania idzie pełny stan dokumentu (zawiera
   * też wszystko, co czekało w kolejce). Wołane tylko z zadań kolejki `run`, więc nie przeplata się
   * z wysyłką ani pobieraniem.
   *
   * Po resecie w kolejce staje **najpierw pobranie, potem wysyłka**: pokój założony od nowa może
   * nieść wpis, po którym nie wolno już nic wysyłać (`canSend`), a pełny stan wysłany na ślepo
   * odtworzyłby na serwerze dane pokoju, który ktoś celowo wycofał.
   */
  private async resetRoom(epoch: string | undefined, count = true): Promise<void> {
    const full = Y.encodeStateAsUpdate(this.opts.doc);
    this.pending = full.length > 2 ? [full] : [];
    const now = this.now();
    // Licznik resetów (wiersz 3): dwa urządzenia z różnym obrazem pokoju mogłyby zakładać go sobie nawzajem bez końca.
    const resets = [...(this.state.resets ?? []), ...(count ? [now] : [])].filter((t) => now - t < RESET_WINDOW_MS).slice(-RESET_KEEP);
    let { warning, warnedAt } = this.state;
    if (count && resets.length >= RESET_LOOP_COUNT) {
      warning = warning === "rollback" && warnedAt !== undefined && now - warnedAt < WARNING_TTL_MS ? warning : "reset-loop";
      warnedAt = now;
      this.opts.onWarning?.("reset-loop", `${resets.length} resety w ciągu doby`);
    }
    this.state = {
      cursor: 0,
      compactedAt: 0,
      ...(epoch ? { epoch } : {}),
      ...(resets.length ? { resets } : {}),
      ...(warning ? { warning, warnedAt } : {}),
    };
    await this.persistPending();
    await this.persistState();
    this.sync();
  }

  private connectSocket(): void {
    if (!this.started || !this.opts.openSocket) return;
    const url = `${this.base.replace(/^http/, "ws")}/ws`;
    const ws = this.opts.openSocket(url);
    this.socket = ws;
    ws.onopen = () => ws.send(JSON.stringify({ type: "subscribe", room: this.opts.keys.roomId, token: this.opts.keys.token }));
    ws.onmessage = (ev: MessageEvent) => {
      let msg: { type?: string; last?: number; epoch?: unknown };
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (msg.type === "ready") {
        this.retryMs = RETRY_MIN_MS;
        this.sync(); // po (re)połączeniu nadrabiamy to, co przyszło, gdy gniazda nie było
      } else if (msg.type === "updated" && typeof msg.last === "number" && (msg.last > this.state.cursor || (epochOf(msg.epoch) ?? this.state.epoch) !== this.state.epoch)) {
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
