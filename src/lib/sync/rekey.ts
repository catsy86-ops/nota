import * as Y from "yjs";

/**
 * Wymiana kodu synchronizacji z wyrzuceniem urządzenia (S2.1; projekt: `docs/plan-wymiana-kodu.md` §3).
 *
 * Trzy części, wszystkie bez dostępu do sieci i do ustawień — te wchodzą przez `RekeyPorts`:
 * - **znacznik** „kod zmieniony” w mapie `syncControl` dokumentu (tworzenie, odczyt, tag);
 * - **zapis wymiany** (`RekeyRecord`) — stan maszyny na urządzeniu, które zmienia kod;
 * - **sterownik** — wykonuje kroki po kolei; każdy krok jest powtarzalny, a zapis zmienia się
 *   dopiero po udanym działaniu, więc przerwanie w dowolnym miejscu powtarza bieżący krok.
 *
 * Kolejność kroków jest częścią projektu: pełny stan w nowym pokoju → znacznik w starym →
 * przełączenie → wycofanie starego pokoju. Przerwanie przed znacznikiem nie zostawia śladu w grupie.
 */

// ── znacznik ─────────────────────────────────────────────────────────────────

export const SYNC_CONTROL_MAP = "syncControl";
const MARKER_PREFIX = "rekey:";
const HEX32 = /^[0-9a-f]{32}$/;
export const MARKER_TTL_MS = 180 * 24 * 60 * 60 * 1000;

export interface RekeyMarker {
  id: string;
  /** Którego kodu dotyczy — `rekeyTag` nazwy pokoju v3 starego kodu. */
  tag: string;
  at: number;
}

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

export function newRekeyId(): string {
  return hex(crypto.getRandomValues(new Uint8Array(16)));
}

/**
 * Tag kodu: pierwsze 16 bajtów SHA-256 z `kaczy-rekey:<nazwa pokoju v3>`. Nazwa v3 pochodzi z PBKDF2,
 * więc z samego znacznika nie da się szybko zgadywać kodu.
 */
export async function rekeyTag(roomV3Name: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`kaczy-rekey:${roomV3Name}`));
  return hex(new Uint8Array(digest).subarray(0, 16));
}

/**
 * Aktualizacja Yjs ze znacznikiem, zbudowana w osobnym, pustym dokumencie. Wpis w mapie głównej nie
 * ma wtedy poprzedników (świeży klient, zegar 0), więc wchodzi na dowolnie stary stan odbiorcy —
 * aktualizacja z głównego dokumentu czekałaby u niego na wcześniejsze operacje tego urządzenia.
 * Każde wywołanie daje inne bajty (inny klient), ale ten sam klucz i tę samą wartość.
 */
export function buildMarkerUpdate(marker: RekeyMarker): Uint8Array {
  const tmp = new Y.Doc();
  tmp.getMap(SYNC_CONTROL_MAP).set(MARKER_PREFIX + marker.id, { v: 1, tag: marker.tag, at: marker.at });
  const update = Y.encodeStateAsUpdate(tmp);
  tmp.destroy();
  return update;
}

function cleanMarker(key: string, value: unknown): RekeyMarker | null {
  if (!key.startsWith(MARKER_PREFIX)) return null;
  const id = key.slice(MARKER_PREFIX.length);
  if (!HEX32.test(id) || !value || typeof value !== "object") return null;
  const v = value as { v?: unknown; tag?: unknown; at?: unknown };
  if (v.v !== 1 || typeof v.tag !== "string" || !HEX32.test(v.tag) || typeof v.at !== "number" || !Number.isFinite(v.at)) return null;
  return { id, tag: v.tag, at: v.at };
}

/**
 * Poprawne znaczniki z dokumentu. Bez limitu oglądanych wpisów: limit pozwalałby urządzeniu z kodem zapchać mapę
 * śmieciami tak, że prawdziwy znacznik nie zostałby nigdy przeczytany (przegląd bezpieczeństwa D2, W3).
 */
export function readMarkers(doc: Y.Doc): RekeyMarker[] {
  const out: RekeyMarker[] = [];
  for (const [key, value] of doc.getMap(SYNC_CONTROL_MAP).entries()) {
    const m = cleanMarker(key, value);
    if (m) out.push(m);
  }
  return out;
}

/**
 * Znacznik, który każe temu urządzeniu przestać synchronizować: dotyczy jego obecnego kodu (`myTag`),
 * nie jest na liście zignorowanych i nie pochodzi z wymiany prowadzonej przez to urządzenie (`ownId`).
 * `null` = synchronizacja może działać.
 */
export function stoppingMarker(doc: Y.Doc, myTag: string, ignored: readonly string[] = [], ownId?: string | null): RekeyMarker | null {
  for (const m of readMarkers(doc)) {
    if (m.tag === myTag && m.id !== ownId && !ignored.includes(m.id)) return m;
  }
  return null;
}

/** Usuwa znaczniki starsze niż 180 dni i wpisy `rekey:…` o złym kształcie. Zwraca liczbę usuniętych. */
export function pruneMarkers(doc: Y.Doc, now: number): number {
  const map = doc.getMap(SYNC_CONTROL_MAP);
  const stale: string[] = [];
  for (const [key, value] of map.entries()) {
    // Tylko klucze znaczników — mapa może kiedyś nieść inne wpisy sterujące, a usunięcie rozchodzi się do całej grupy.
    if (!key.startsWith(MARKER_PREFIX)) continue;
    const m = cleanMarker(key, value);
    if (!m || now - m.at > MARKER_TTL_MS) stale.push(key);
  }
  if (stale.length === 0) return 0;
  doc.transact(() => stale.forEach((k) => map.delete(k)));
  return stale.length;
}

// ── zapis wymiany ────────────────────────────────────────────────────────────

export const REKEY_STORAGE_KEY = "kaczy.sync.rekey.v1";
/** Blokada między kartami: wymianę prowadzi jedna (I-4). */
export const REKEY_LOCK = "notatnik-wymiana-kodu";
/** Stary pokój znika po tylu dniach od przełączenia (D-F1). */
export const RETIRE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
/** Po tylu dniach nieudanego wycofywania przestajemy próbować. */
export const RETIRE_GIVE_UP_MS = 30 * 24 * 60 * 60 * 1000;
/** Bez przekaźnika: tyle czekamy, aż znacznik rozejdzie się do połączonych urządzeń. */
export const MARKER_SPREAD_MS = 5000;
/** Po tylu nieudanych wysyłkach znacznika wolno go pominąć. */
export const MARKER_SKIP_AFTER = 3;

export type RekeyStep = "prepared" | "seeded" | "marked" | "switched" | "done";

export interface RekeyDevice {
  name: string;
  version?: string;
  done: boolean;
}

export interface RekeyRecord {
  v: 1;
  /** Ten sam co w kluczu znacznika. */
  id: string;
  step: RekeyStep;
  /** Kasowany przy przejściu do `done`. */
  oldCode: string | null;
  newCode: string;
  /** Tag starego kodu. */
  tag: string;
  /** Adres przekaźnika z chwili startu; `null` = sama droga bezpośrednia. */
  relay: string | null;
  startedAt: number;
  /**
   * Znacznik mógł już wyjść z urządzenia. Zapisywane **przed** nałożeniem go na dokument: po
   * przerwaniu między nałożeniem a zapisem kroku `marked` anulowanie zostawiłoby grupę zatrzymaną
   * znacznikiem, za którym nie idzie żadna zmiana kodu.
   */
  markStarted?: boolean;
  markTries?: number;
  /** Użytkownik pominął wysyłkę znacznika na przekaźnik. */
  markerSkipped?: boolean;
  switchedAt?: number;
  retireAt?: number;
  retireTries?: number;
  /** Urządzenia do ponownego sparowania. */
  devices: RekeyDevice[];
  error?: { step: RekeyStep; message: string; at: number };
}

const STEPS: readonly RekeyStep[] = ["prepared", "seeded", "marked", "switched", "done"];

/** Czyta zapis z tekstu; cokolwiek o złym kształcie to `null` (zapis jest lokalny, ale bywa ucięty). */
export function parseRekeyRecord(raw: string | null): RekeyRecord | null {
  if (!raw) return null;
  let r: Partial<RekeyRecord>;
  try {
    r = JSON.parse(raw) as Partial<RekeyRecord>;
  } catch {
    return null;
  }
  if (!r || typeof r !== "object" || r.v !== 1) return null;
  if (typeof r.id !== "string" || !HEX32.test(r.id) || typeof r.tag !== "string" || !HEX32.test(r.tag)) return null;
  if (!STEPS.includes(r.step as RekeyStep) || typeof r.newCode !== "string" || !r.newCode) return null;
  if (r.oldCode !== null && typeof r.oldCode !== "string") return null;
  if (r.step !== "done" && !r.oldCode) return null;
  if (r.relay !== null && typeof r.relay !== "string") return null;
  if (typeof r.startedAt !== "number" || !Array.isArray(r.devices)) return null;
  const devices = r.devices
    .filter((d): d is RekeyDevice => !!d && typeof d.name === "string")
    .map((d) => ({ name: d.name, ...(typeof d.version === "string" ? { version: d.version } : {}), done: d.done === true }));
  return { ...(r as RekeyRecord), devices };
}

/** Znacznik tej wymiany. `at` to chwila startu, więc powtórzony krok pisze tę samą wartość. */
export const markerOf = (r: RekeyRecord): RekeyMarker => ({ id: r.id, tag: r.tag, at: r.startedAt });

/** Anulować wolno tylko, dopóki znacznik nie mógł wyjść z urządzenia. */
export function canCancelRekey(r: RekeyRecord): boolean {
  return (r.step === "prepared" || r.step === "seeded") && !r.markStarted;
}

/** Czy użytkownik może pominąć wysyłkę znacznika na przekaźnik (po kilku nieudanych próbach). */
export function canSkipMarker(r: RekeyRecord): boolean {
  return r.step === "seeded" && !!r.relay && (r.markTries ?? 0) >= MARKER_SKIP_AFTER;
}

/** Odhacza urządzenie na liście do ponownego sparowania. */
export function withDevicePaired(r: RekeyRecord, name: string): RekeyRecord {
  if (!r.devices.some((d) => d.name === name && !d.done)) return r;
  return { ...r, devices: r.devices.map((d) => (d.name === name ? { ...d, done: true } : d)) };
}

/** Zapis zakończonej wymiany można usunąć, gdy nie ma już kogo parować. */
export function rekeyFinished(r: RekeyRecord): boolean {
  return r.step === "done" && r.devices.every((d) => d.done);
}

// ── sterownik ────────────────────────────────────────────────────────────────

/** Wszystko, czego sterownik potrzebuje z zewnątrz. Każda operacja musi być powtarzalna. */
export interface RekeyPorts {
  now(): number;
  load(): RekeyRecord | null;
  /** `null` usuwa zapis. Rzuca, gdy zapis się nie udał — sterownik wtedy nie idzie dalej. */
  save(record: RekeyRecord | null): void;
  /** Kod, z którym urządzenie jest teraz połączone (z ustawień). */
  currentCode(): string | null;
  /** Nowy kod — zawsze długi. */
  newCode(): string;
  /** `rekeyTag(roomNameV3For(code))`. */
  tagFor(code: string): Promise<string>;
  /** Poprawny adres przekaźnika albo `null`. */
  relayUrl(): string | null;
  /** Urządzenia grupy do ponownego sparowania, bez własnego. */
  devices(): { name: string; version?: string }[];
  /** Nowy pokój przekaźnika z pełnym stanem dokumentu, sprawdzony odczytem. Rzuca przy niepowodzeniu. */
  seedRoom(relay: string, newCode: string): Promise<void>;
  /** Best effort: usuwa nowy pokój po anulowaniu. */
  dropRoom(relay: string, code: string): Promise<void>;
  /** Nakłada aktualizację znacznika na główny dokument (rozchodzi się zwykłymi drogami). */
  applyMarker(update: Uint8Array): void;
  /** Wysyła aktualizację znacznika wprost do starego pokoju przekaźnika. Rzuca przy niepowodzeniu. */
  postMarker(relay: string, oldCode: string, update: Uint8Array): Promise<void>;
  /** Liczba urządzeń połączonych drogą bezpośrednią. */
  peers(): number;
  wait(ms: number): Promise<void>;
  /** Jednym zapisem ustawień przechodzi na nowy kod i łączy się nim. Rzuca, gdy zapis się nie udał. */
  switchTo(newCode: string): void;
  /** Usuwa stary pokój i zostawia w nim sam znacznik; `false` = w pokoju jest coś jeszcze. */
  retireRoom(relay: string, oldCode: string, update: Uint8Array): Promise<boolean>;
  /** Usuwa lokalną kolejkę i kursor starego pokoju. */
  forgetRoom(oldCode: string): Promise<void>;
  /** Uruchamia `fn`, jeśli wymiany nie prowadzi inna karta; inaczej `null`. */
  lock<T>(fn: () => Promise<T>): Promise<T | null>;
}

export type RekeyWait =
  /** Zapis jest gotowy, czeka na potwierdzenie użytkownika (`runRekey` z `confirmed`). */
  | "confirm"
  /** Przełączone; stary pokój zostanie wycofany, gdy minie `retireAt`. */
  | "retire"
  /** Krok się nie udał — szczegóły w `record.error`; ponowne `runRekey` próbuje jeszcze raz. */
  | "error"
  /** Wymianę prowadzi inna karta. */
  | "busy"
  /** Nie ma czego robić: brak zapisu albo wymiana zakończona. */
  | "idle";

export interface RekeyResult {
  record: RekeyRecord | null;
  wait: RekeyWait;
}

const message = (err: unknown) => (err instanceof Error && err.message ? err.message : "Nieznany błąd");

/** Krok 0: przygotowuje zapis. Nic nie wychodzi poza urządzenie. Istniejący zapis zostaje. */
export async function prepareRekey(ports: RekeyPorts): Promise<RekeyResult> {
  const existing = ports.load();
  if (existing) return { record: existing, wait: existing.step === "prepared" ? "confirm" : "idle" };
  const oldCode = ports.currentCode();
  if (!oldCode) return { record: null, wait: "idle" };
  const record: RekeyRecord = {
    v: 1,
    id: newRekeyId(),
    step: "prepared",
    oldCode,
    newCode: ports.newCode(),
    tag: await ports.tagFor(oldCode),
    relay: ports.relayUrl(),
    startedAt: ports.now(),
    devices: ports.devices().map((d) => ({ ...d, done: false })),
  };
  ports.save(record);
  return { record, wait: "confirm" };
}

/** Anuluje wymianę, jeśli jeszcze wolno. `false` = za późno (znacznik mógł wyjść) albo prowadzi inna karta. */
export async function cancelRekey(ports: RekeyPorts): Promise<boolean> {
  const done = await ports.lock(async () => {
    const r = ports.load();
    if (!r) return true;
    if (!canCancelRekey(r)) return false;
    ports.save(null);
    // Pokój mógł powstać także wtedy, gdy krok nie zdążył się zapisać — stąd próba już od `prepared`.
    if (r.relay) await ports.dropRoom(r.relay, r.newCode).catch(() => undefined);
    return true;
  });
  return done === true;
}

export interface RunOptions {
  /** Użytkownik potwierdził ekran ostrzeżeń — bez tego wymiana nie rusza z `prepared`. */
  confirmed?: boolean;
  /** „Pomiń — urządzenia offline nie dostaną informacji” (tylko gdy `canSkipMarker`). */
  skipMarker?: boolean;
  /** „Usuń teraz” — nie czekaj na `retireAt`. */
  retireNow?: boolean;
}

/**
 * Wykonuje kolejne kroki, aż wymiana się skończy albo trzeba poczekać (na użytkownika, na termin,
 * na sieć). Bezpieczne do wołania wielokrotnie: przy starcie aplikacji, po powrocie sieci, z przycisku.
 */
export async function runRekey(ports: RekeyPorts, opts: RunOptions = {}): Promise<RekeyResult> {
  const result = await ports.lock(async (): Promise<RekeyResult> => {
    let r = ports.load();
    if (!r) return { record: null, wait: "idle" };
    for (;;) {
      const before: RekeyRecord = r;
      let next: RekeyRecord | RekeyWait;
      try {
        next = await stepOnce(ports, before, opts);
      } catch (err) {
        const failed: RekeyRecord = {
          ...(ports.load() ?? before),
          error: { step: before.step, message: message(err), at: ports.now() },
        };
        if (before.step === "seeded") failed.markTries = (before.markTries ?? 0) + 1;
        if (before.step === "switched") failed.retireTries = (before.retireTries ?? 0) + 1;
        try {
          ports.save(failed);
        } catch {
          // zapis błędu jest pomocniczy; krok i tak powtórzy się od początku
        }
        return { record: failed, wait: "error" };
      }
      if (typeof next === "string") return { record: r, wait: next };
      try {
        ports.save(next);
      } catch (err) {
        // Działanie się udało, ale krok nie został zapisany: zostajemy na poprzednim i go powtórzymy.
        return { record: { ...before, error: { step: before.step, message: message(err), at: ports.now() } }, wait: "error" };
      }
      r = next;
    }
  });
  return result ?? { record: ports.load(), wait: "busy" };
}

/** Jedno działanie: zwraca zapis po przejściu albo powód, dla którego trzeba poczekać. */
async function stepOnce(ports: RekeyPorts, r: RekeyRecord, opts: RunOptions): Promise<RekeyRecord | RekeyWait> {
  const clean = (rec: RekeyRecord): RekeyRecord => {
    const { error: _error, ...rest } = rec;
    return rest;
  };
  switch (r.step) {
    case "prepared": {
      if (!opts.confirmed) return "confirm";
      if (r.relay) await ports.seedRoom(r.relay, r.newCode);
      return { ...clean(r), step: "seeded" };
    }
    case "seeded": {
      const oldCode = r.oldCode!;
      if (!r.markStarted) {
        // Najpierw ślad, potem działanie: od tej chwili anulowanie jest zamknięte.
        r = { ...r, markStarted: true };
        ports.save(r);
      }
      const update = buildMarkerUpdate(markerOf(r));
      ports.applyMarker(update);
      let skipped = r.markerSkipped === true;
      if (r.relay && !skipped) {
        if (opts.skipMarker && canSkipMarker(r)) skipped = true;
        else await ports.postMarker(r.relay, oldCode, update);
      } else if (!r.relay && ports.peers() > 0) {
        // Bez przekaźnika nie ma potwierdzeń: dajemy połączonym urządzeniom chwilę na odbiór.
        await ports.wait(MARKER_SPREAD_MS);
      }
      return { ...clean(r), step: "marked", ...(skipped ? { markerSkipped: true } : {}) };
    }
    case "marked": {
      if (ports.currentCode() !== r.newCode) ports.switchTo(r.newCode);
      const switchedAt = r.switchedAt ?? ports.now();
      return { ...clean(r), step: "switched", switchedAt, retireAt: r.retireAt ?? switchedAt + RETIRE_AFTER_MS };
    }
    case "switched": {
      const oldCode = r.oldCode!;
      const retireAt = r.retireAt ?? ports.now();
      const finish = async (error?: RekeyRecord["error"]): Promise<RekeyRecord> => {
        await ports.forgetRoom(oldCode).catch(() => undefined);
        return { ...clean(r), step: "done", oldCode: null, ...(error ? { error } : {}) };
      };
      if (!r.relay) return finish();
      if (!opts.retireNow && ports.now() < retireAt) return "retire";
      if (ports.now() - retireAt > RETIRE_GIVE_UP_MS) {
        return finish({ step: "switched", message: "Nie udało się usunąć starego pokoju z przekaźnika", at: ports.now() });
      }
      const ok = await ports.retireRoom(r.relay, oldCode, buildMarkerUpdate(markerOf(r)));
      if (!ok) throw new Error("W starym pokoju wciąż pojawiają się dane innego urządzenia");
      return finish();
    }
    case "done":
      return "idle";
  }
}
