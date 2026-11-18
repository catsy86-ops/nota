/**
 * Blokada wyłączna między kartami (Web Locks). Dla operacji krótkich i nieodwracalnych
 * — migracje, import kopii — żeby dwie karty nie robiły ich naraz.
 * Bez `navigator.locks` (starsze WebView) zostaje kolejka w obrębie jednej karty.
 * Prace długotrwałe mają rolę karty prowadzącej (`holdTabRole`), nie blokadę wyłączną.
 */
const queues = new Map<string, Promise<unknown>>();

export function withExclusiveLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (locks?.request) return locks.request(name, { mode: "exclusive" }, fn) as Promise<T>;
  const prev = queues.get(name) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  queues.set(name, run.catch(() => undefined));
  return run;
}

export const MIGRATION_LOCK = "notatnik-migracja";
/** Odśmiecanie magazynu obrazów: naraz w jednej karcie, pozostałe je pomijają. */
export const GC_LOCK = "notatnik-gc";
/** Z-7.1: zmiana hasła skarbca i reset kodem awaryjnym — jedna karta naraz. */
export const VAULT_LOCK = "notatnik-skarbiec";
/** Z-7.3: automatyczna kopia do pliku — robi ją jedna karta, pozostałe pomijają przebieg. */
export const AUTO_BACKUP_LOCK = "notatnik-auto-kopia";
/** Karta prowadząca przekaźnik: jeden kursor i jedna kolejka wysyłki na przeglądarkę. */
export const RELAY_ROLE = "notatnik-przekaznik";

/**
 * Uruchamia `fn` tylko wtedy, gdy blokada jest wolna; zajęta = `null` bez czekania.
 * Dla prac okresowych, które wystarczy zrobić w jednej karcie (odśmiecanie).
 */
export function withLockIfFree<T>(name: string, fn: () => Promise<T>): Promise<T | null> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!locks?.request) return fn();
  return locks.request(name, { mode: "exclusive", ifAvailable: true }, (lock) => (lock ? fn() : null)) as Promise<T | null>;
}

/**
 * Rola karty prowadzącej dla prac długotrwałych (przekaźnik): blokada trzymana do wywołania
 * zwróconej funkcji albo zamknięcia karty — wtedy przeglądarka sama oddaje ją następnej karcie
 * w kolejce i tam woła się `onAcquire`. `onWait` — gdy rolę ma teraz inna karta.
 * Bez `navigator.locks` każda karta prowadzi sama, jak przed wprowadzeniem ról.
 */
export function holdTabRole(name: string, onAcquire: () => void, onWait?: () => void): () => void {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  let cancelled = false;
  if (!locks?.request) {
    void Promise.resolve().then(() => { if (!cancelled) onAcquire(); });
    return () => { cancelled = true; };
  }
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  const abort = new AbortController();
  const lead = () => {
    if (cancelled) return undefined;
    onAcquire();
    return held;
  };
  // Najpierw próba bez czekania: tylko tak widać, że rolę ma inna karta.
  void locks.request(name, { mode: "exclusive", ifAvailable: true }, (lock) => {
    if (lock) return lead();
    if (cancelled) return undefined;
    onWait?.();
    // Odrzucenie = przerwane czekanie (`abort`) — nie ma czego obsługiwać.
    locks.request(name, { mode: "exclusive", signal: abort.signal }, lead).catch(() => undefined);
    return undefined;
  }).catch(() => undefined);
  return () => {
    cancelled = true;
    abort.abort();
    release();
  };
}
