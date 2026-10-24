/**
 * Małe RPC nad `postMessage` dla Web Workerów (plan rozbudowy, Faza 0).
 *
 * Transport jest wstrzykiwany: w przeglądarce to `Worker`, w testach (jsdom nie ma
 * Workerów) para połączonych kanałów. Wiadomości są płaskie: żądanie `{ id, method, args }`,
 * odpowiedź `{ id, ok, result }` albo `{ id, ok: false, error }`. Błędy wracają jako tekst,
 * nie obiekt — Worker nie przenosi stack trace'ów ani klas.
 */

export interface RpcRequest {
  id: number;
  method: string;
  args: unknown[];
}

export type RpcResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: string };

/** Dwukierunkowy kanał: `send` wysyła, `onMessage` podpina odbiorcę i zwraca odpięcie. */
export interface RpcTransport {
  send(message: unknown): void;
  onMessage(listener: (message: unknown) => void): () => void;
  close(): void;
}

export type RpcHandlers = Record<string, (...args: never[]) => unknown>;

/** Po stronie Workera: wykonuje metody i odsyła wyniki (także asynchroniczne). */
export function serveRpc(handlers: RpcHandlers, transport: RpcTransport): () => void {
  return transport.onMessage((raw) => {
    const req = raw as RpcRequest;
    if (!req || typeof req.id !== "number" || typeof req.method !== "string") return;
    const fn = Object.prototype.hasOwnProperty.call(handlers, req.method)
      ? (handlers[req.method] as (...args: unknown[]) => unknown)
      : undefined;
    const reply = (res: RpcResponse) => transport.send(res);
    if (!fn) {
      reply({ id: req.id, ok: false, error: `Nieznana metoda: ${req.method}` });
      return;
    }
    Promise.resolve()
      .then(() => fn(...(Array.isArray(req.args) ? req.args : [])))
      .then(
        (result) => reply({ id: req.id, ok: true, result }),
        (err: unknown) => reply({ id: req.id, ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
  });
}

export interface RpcClientOptions {
  /** Po tylu milisekundach bez oczekujących wywołań transport się zamyka (zwalnia pamięć Workera). */
  idleMs?: number;
}

export interface RpcClient<H extends RpcHandlers> {
  call<K extends keyof H & string>(method: K, ...args: Parameters<H[K]>): Promise<Awaited<ReturnType<H[K]>>>;
  /** Zamyka transport i odrzuca oczekujące wywołania. */
  dispose(): void;
}

/**
 * Po stronie strony: `open` tworzy transport (np. `new Worker(...)`). Przy bezczynności
 * transport zamykany jest po `idleMs`, a następne wywołanie otwiera go ponownie.
 */
export function createRpcClient<H extends RpcHandlers>(
  open: () => RpcTransport,
  { idleMs = 0 }: RpcClientOptions = {},
): RpcClient<H> {
  type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };
  const pending = new Map<number, Pending>();
  let nextId = 1;
  let transport: RpcTransport | null = null;
  let unsubscribe: (() => void) | null = null;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  function ensureTransport(): RpcTransport {
    if (idleTimer !== null) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
    if (transport) return transport;
    const t = open();
    transport = t;
    unsubscribe = t.onMessage((raw) => {
      const res = raw as RpcResponse;
      const p = pending.get(res?.id);
      if (!p) return;
      pending.delete(res.id);
      if (res.ok) p.resolve(res.result);
      else p.reject(new Error(res.error));
      scheduleIdle();
    });
    return t;
  }

  function closeTransport() {
    unsubscribe?.();
    unsubscribe = null;
    transport?.close();
    transport = null;
  }

  function scheduleIdle() {
    if (idleMs <= 0 || pending.size > 0 || idleTimer !== null) return;
    idleTimer = setTimeout(() => {
      idleTimer = null;
      if (pending.size === 0) closeTransport();
    }, idleMs);
  }

  return {
    call(method, ...args) {
      const t = ensureTransport();
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
        const req: RpcRequest = { id, method, args };
        t.send(req);
      }) as Promise<never>;
    },
    dispose() {
      if (idleTimer !== null) clearTimeout(idleTimer);
      idleTimer = null;
      for (const [, p] of pending) p.reject(new Error("Worker zamknięty"));
      pending.clear();
      closeTransport();
    },
  };
}

/** Minimalny kształt `self` wewnątrz Workera (bez typów `WebWorker` w tsconfig). */
export interface WorkerScope {
  postMessage(message: unknown): void;
  addEventListener(type: "message", listener: (e: MessageEvent) => void): void;
  removeEventListener(type: "message", listener: (e: MessageEvent) => void): void;
  close(): void;
}

/** Transport po stronie Workera: odpowiedzi idą do strony, która go uruchomiła. */
export function workerScopeTransport(scope: WorkerScope): RpcTransport {
  return {
    send: (message) => scope.postMessage(message),
    onMessage: (listener) => {
      const h = (e: MessageEvent) => listener(e.data);
      scope.addEventListener("message", h);
      return () => scope.removeEventListener("message", h);
    },
    close: () => scope.close(),
  };
}

/** Transport nad prawdziwym `Worker` (tylko przeglądarka). */
export function workerTransport(worker: Worker): RpcTransport {
  return {
    send: (message) => worker.postMessage(message),
    onMessage: (listener) => {
      const h = (e: MessageEvent) => listener(e.data);
      worker.addEventListener("message", h);
      return () => worker.removeEventListener("message", h);
    },
    close: () => worker.terminate(),
  };
}
