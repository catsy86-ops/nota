import { yjsStore } from "@/lib/yjsStore";
import { sha256Hex } from "@/lib/imageStore";
import { APP_VERSION } from "@/content/changelog";
import { SCHEMA_VERSION } from "@/lib/formatSchema";
import { MIGRATION_LOCK, withExclusiveLock, withLockIfFree } from "@/lib/tabLock";
import { localDayKey } from "@/lib/dayDone";
import { logDiag } from "@/lib/diagnostics";
import { DANE } from "@/lib/storage/names";

/**
 * Kopie dzienne w OPFS (Q1.4, Z-16.1 część A, `docs/plan-dane-lokalne.md` §1.3–1.4): raz na dzień lokalny pełny stan
 * głównego dokumentu Yjs w katalogu `kopie-dzienne/`, poza IndexedDB — przeżywa uszkodzenie bazy dokumentu, ale nie
 * „Wyczyść dane witryny”. Bez obrazów, załączników i historii wersji. Bez dodatkowego szyfrowania (QL-1): notatki
 * prywatne są zaszyfrowane już w dokumencie.
 *
 * Plik `RRRR-MM-DD.nkopia`: 4 bajty `NKD1`, 4 bajty długości nagłówka (big-endian), nagłówek JSON, treść
 * `Y.encodeStateAsUpdateV2`. `indeks.json` to tylko pamięć podręczna i miejsce na przypięcie; źródłem prawdy są pliki.
 */

export const SNAPSHOT_DIR = "kopie-dzienne";
/** Kopie sprzed wymiany dokumentu (Z-16.1B): wymianę da się cofnąć tą samą ścieżką; usuwane po 30 dniach. */
export const BEFORE_DIR = "kopie-przed-przywroceniem";
export const BEFORE_KEEP_MS = 30 * 24 * 60 * 60 * 1000;
export const SNAPSHOT_INDEX = "indeks.json";
export const SNAPSHOT_KEEP = 7;
/** Przypięcie poprzedniej, gdy nowa ma mniej niż połowę jej notatek, a poprzednia miała co najmniej tyle. */
export const PIN_MIN_NOTES = 20;
const MAGIC = "NKD1";
const FORMAT = 1;
/** Górna granica treści przy czytaniu (§1.3). */
export const SNAPSHOT_MAX_BYTES = 256 * 1024 * 1024;
const MAX_HEADER = 64 * 1024;
const LOCK = "notatnik-kopia-dzienna";
const EXT = ".nkopia";

/** Wynik ostatniej próby — wiersz w „Trwałości danych” (lokalnie, poza kopią). */
export const SNAPSHOT_STATUS_KEY = DANE.snapshotStatus;
/** Ostatnia udana migawka — baner „dane zniknęły” z części B (§1.6). */
export const SNAPSHOT_LAST_KEY = DANE.snapshotLast;

export interface SnapshotHeader {
  v: number;
  createdAt: number;
  app: string;
  schema: number;
  notes: number;
  bytes: number;
  sha256: string;
  /** Skrót wektora stanu. Do decyzji „dzień bez zmian” służy `sha256` treści: samo usunięcie nie przesuwa wektora stanu. */
  sv: string;
}

export type SnapshotState = "ok" | "broken" | "newer";

export interface SnapshotEntry {
  file: string;
  /** `katalog/plik` — do `readSnapshotFile` i zamiaru wymiany dokumentu. */
  ref: string;
  /** „daily” — kopia dzienna (rotacja), „before” — kopia sprzed wymiany dokumentu (30 dni, poza rotacją). */
  kind: "daily" | "before";
  /** Z nagłówka; dla pliku uszkodzonego — północ dnia z nazwy. */
  createdAt: number;
  notes: number | null;
  bytes: number;
  state: SnapshotState;
  pinned: boolean;
  sha256: string | null;
}

export type SnapshotResult = "written" | "exists" | "unchanged" | "busy" | "unsupported" | "quota" | "error";

export interface SnapshotStatus {
  at: number;
  result: SnapshotResult;
}

/** Źródło stanu dokumentu — w testach zastępowane. */
export interface SnapshotSource {
  encode(): Uint8Array;
  stateVector(): Uint8Array;
  notes(): number;
  /** Wymiana porcjami w toku (przywracanie, import) — stan pośredni nie może zostać kopią dnia. */
  busy?(): boolean;
}

/** Dostęp do katalogu i zapisu — w testach atrapa OPFS. */
export interface SnapshotEnv {
  root(): Promise<FileSystemDirectoryHandle | null>;
  now(): Date;
  write(dir: FileSystemDirectoryHandle, name: string, bytes: Uint8Array): Promise<void>;
  /** Blokada bez czekania: zajęta → `null` (inna karta robi kopię albo trwa przywracanie/import). */
  lock<T>(fn: () => Promise<T>): Promise<T | null>;
  /** Blokada z czekaniem — dla działań użytkownika („Odepnij”). */
  lockWait<T>(fn: () => Promise<T>): Promise<T>;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

export function snapshotFileName(d: Date): string {
  return `${localDayKey(d)}${EXT}`;
}

function dayFromName(file: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})\.nkopia$/.exec(file);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime() : 0;
}

/** Plik: magia, długość nagłówka, nagłówek, treść. */
export async function encodeSnapshot(body: Uint8Array, meta: { createdAt: number; notes: number; sv: string }): Promise<{ bytes: Uint8Array; header: SnapshotHeader }> {
  const header: SnapshotHeader = {
    v: FORMAT, createdAt: meta.createdAt, app: APP_VERSION, schema: SCHEMA_VERSION,
    notes: meta.notes, bytes: body.length, sha256: await sha256Hex(body), sv: meta.sv,
  };
  const head = enc.encode(JSON.stringify(header));
  const out = new Uint8Array(8 + head.length + body.length);
  out.set(enc.encode(MAGIC), 0);
  new DataView(out.buffer).setUint32(4, head.length);
  out.set(head, 8);
  out.set(body, 8 + head.length);
  return { bytes: out, header };
}

export type ParsedSnapshot = { state: "ok"; header: SnapshotHeader; body: Uint8Array } | { state: "broken" | "newer"; header: SnapshotHeader | null };

/** Sprawdza magię, długości i skrót treści. `v` większe niż znane → „newer” (nie da się przywrócić). */
export async function parseSnapshot(bytes: Uint8Array): Promise<ParsedSnapshot> {
  if (bytes.length < 8 || dec.decode(bytes.subarray(0, 4)) !== MAGIC) return { state: "broken", header: null };
  const headLen = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4);
  if (headLen > MAX_HEADER || 8 + headLen > bytes.length) return { state: "broken", header: null };
  let header: SnapshotHeader;
  try {
    header = JSON.parse(dec.decode(bytes.subarray(8, 8 + headLen))) as SnapshotHeader;
  } catch {
    return { state: "broken", header: null };
  }
  if (!header || typeof header.v !== "number" || typeof header.bytes !== "number" || typeof header.sha256 !== "string") return { state: "broken", header: null };
  if (header.v > FORMAT) return { state: "newer", header };
  const body = bytes.subarray(8 + headLen);
  if (body.length !== header.bytes || header.bytes > SNAPSHOT_MAX_BYTES) return { state: "broken", header };
  if (await sha256Hex(body) !== header.sha256) return { state: "broken", header };
  return { state: "ok", header, body };
}

async function fileNames(dir: FileSystemDirectoryHandle): Promise<string[]> {
  const names: string[] = [];
  for await (const name of (dir as unknown as { keys(): AsyncIterable<string> }).keys()) if (name.endsWith(EXT)) names.push(name);
  return names.sort().reverse();
}

async function readBytes(dir: FileSystemDirectoryHandle, name: string): Promise<Uint8Array | null> {
  const file = await (await dir.getFileHandle(name)).getFile();
  if (file.size > SNAPSHOT_MAX_BYTES + MAX_HEADER + 8) return null;
  return new Uint8Array(await file.arrayBuffer());
}

interface IndexFile {
  v: 1;
  pinned: string | null;
  files: { file: string; createdAt: number; notes: number | null; bytes: number }[];
}

async function readIndex(dir: FileSystemDirectoryHandle): Promise<IndexFile | null> {
  try {
    const data = JSON.parse(dec.decode(await readBytes(dir, SNAPSHOT_INDEX) ?? new Uint8Array())) as IndexFile;
    return data && Array.isArray(data.files) ? data : null;
  } catch {
    return null;
  }
}

/** Zapis indeksu; `false` przy błędzie — wtedy rotacja nie może usuwać (przypięcie żyje tylko w indeksie). */
async function writeIndex(env: SnapshotEnv, dir: FileSystemDirectoryHandle, entries: SnapshotEntry[]): Promise<boolean> {
  const index: IndexFile = {
    v: 1,
    pinned: entries.find((e) => e.pinned)?.file ?? null,
    files: entries.map(({ file, createdAt, notes, bytes }) => ({ file, createdAt, notes, bytes })),
  };
  try {
    await env.write(dir, SNAPSHOT_INDEX, enc.encode(JSON.stringify(index)));
    return true;
  } catch (err) {
    logDiag("warn", "snapshot", "cannot write index", err);
    return false;
  }
}

/** Jeden plik, sprawdzony w całości; `null`, gdy go nie ma. */
async function readEntry(dir: FileSystemDirectoryHandle, file: string, pinned: string | null, kind: SnapshotEntry["kind"] = "daily"): Promise<SnapshotEntry | null> {
  let parsed: ParsedSnapshot = { state: "broken", header: null };
  let size = 0;
  try {
    const bytes = await readBytes(dir, file);
    size = bytes?.length ?? 0;
    if (bytes) parsed = await parseSnapshot(bytes);
  } catch (err) {
    if ((err as { name?: string } | null)?.name === "NotFoundError") return null;
    logDiag("warn", "snapshot", `cannot read ${file}`, err);
  }
  const h = parsed.header;
  return {
    file,
    ref: `${kind === "daily" ? SNAPSHOT_DIR : BEFORE_DIR}/${file}`,
    kind,
    createdAt: h && typeof h.createdAt === "number" ? h.createdAt : dayFromName(file),
    notes: h && typeof h.notes === "number" ? h.notes : null,
    bytes: size,
    state: parsed.state,
    pinned: file === pinned,
    sha256: parsed.state === "ok" ? parsed.header.sha256 : null,
  };
}

/** Wszystkie pliki migawek, od najnowszej, każdy sprawdzony (nagłówek, długość, skrót). */
async function scan(dir: FileSystemDirectoryHandle, kind: SnapshotEntry["kind"] = "daily"): Promise<SnapshotEntry[]> {
  const pinned = kind === "daily" ? (await readIndex(dir))?.pinned ?? null : null;
  const out: SnapshotEntry[] = [];
  for (const file of await fileNames(dir)) {
    const e = await readEntry(dir, file, pinned, kind);
    if (e) out.push(e);
  }
  return out;
}

async function snapshotDir(env: SnapshotEnv, name: string = SNAPSHOT_DIR): Promise<FileSystemDirectoryHandle | null> {
  const root = await env.root();
  return root ? root.getDirectoryHandle(name, { create: true }) : null;
}

/**
 * Rotacja (§1.4): zostaje `SNAPSHOT_KEEP` najnowszych poprawnych plików plus przypięty. Uszkodzone i nowszego formatu
 * starsze od ostatniej zachowanej poprawnej też odpadają; nowsze zostają na liście jako „uszkodzona”.
 */
function toDelete(entries: SnapshotEntry[]): SnapshotEntry[] {
  let kept = 0;
  const out: SnapshotEntry[] = [];
  for (const e of entries) {
    // Plików nowszej wersji aplikacji ta wersja nie umie czytać — nie usuwa ich (powrót do starszej wersji).
    if (e.pinned || e.state === "newer") continue;
    if (kept >= SNAPSHOT_KEEP) out.push(e);
    else if (e.state === "ok") kept++;
  }
  return out;
}

async function remove(dir: FileSystemDirectoryHandle, file: string): Promise<boolean> {
  try {
    await dir.removeEntry(file);
    return true;
  } catch (err) {
    logDiag("warn", "snapshot", `cannot remove ${file}`, err);
    return false;
  }
}

const isQuota = (err: unknown) => (err as { name?: string } | null)?.name === "QuotaExceededError";

function saveStatus(at: number, result: SnapshotResult) {
  try { localStorage.setItem(SNAPSHOT_STATUS_KEY, JSON.stringify({ at, result } satisfies SnapshotStatus)); } catch { /* bez localStorage — bez wiersza */ }
}

/**
 * Jedna migawka na dzień lokalny. Kolejność: blokada jednej karty (i brak przywracania/importu) → czy dzisiejsza już
 * jest (poprawna; czytany tylko ten plik) → skrót treści równy najnowszej → pomijamy → zapis → odczyt i sprawdzenie
 * skrótu → przypięcie poprzedniej przy spadku liczby notatek → indeks → rotacja. Brak miejsca: usunięcie najstarszej
 * nieprzypiętej (nie tej, która ma zostać przypięta) i jedna ponowna próba.
 */
export async function takeDailySnapshot(src: SnapshotSource, env: SnapshotEnv = browserEnv): Promise<SnapshotResult> {
  const now = env.now();
  let dir: FileSystemDirectoryHandle | null;
  try {
    dir = await snapshotDir(env);
  } catch (err) {
    logDiag("info", "snapshot", "OPFS niedostępny", err);
    dir = null;
  }
  if (!dir) {
    saveStatus(now.getTime(), "unsupported");
    return "unsupported";
  }
  const folder = dir;
  const result = await env.lock(async (): Promise<SnapshotResult | null> => {
    if (src.busy?.()) return null;
    try {
      const name = snapshotFileName(now);
      // Najczęstszy przypadek (każdy start, każde schowanie karty): dzisiejsza już jest — bez czytania pozostałych.
      const today = await readEntry(folder, name, null);
      if (today?.state === "ok") return "exists";
      // Uszkodzony dzisiejszy (przerwany zapis) nie blokuje dnia.
      if (today) await remove(folder, name);
      let entries = (await scan(folder)).filter((e) => e.file !== name);
      const latest = entries.find((e) => e.state === "ok") ?? null;
      const body = src.encode();
      const { bytes, header } = await encodeSnapshot(body, {
        createdAt: now.getTime(), notes: src.notes(), sv: await sha256Hex(src.stateVector()),
      });
      if (latest && latest.sha256 === header.sha256) return "unchanged";
      const pinLatest = !!latest && latest.notes !== null && latest.notes >= PIN_MIN_NOTES && header.notes < latest.notes / 2;

      try {
        await env.write(folder, name, bytes);
      } catch (err) {
        if (!isQuota(err)) throw err;
        await remove(folder, name);
        const oldest = [...entries].reverse().find((e) => !e.pinned && e.state !== "newer" && !(pinLatest && e === latest));
        if (!oldest || !(await remove(folder, oldest.file))) return "quota";
        entries = entries.filter((e) => e !== oldest);
        try {
          await env.write(folder, name, bytes);
        } catch (again) {
          await remove(folder, name);
          if (isQuota(again)) return "quota";
          throw again;
        }
      }

      const check = await parseSnapshot((await readBytes(folder, name)) ?? new Uint8Array());
      if (check.state !== "ok" || check.header.sha256 !== header.sha256) {
        await remove(folder, name);
        logDiag("warn", "snapshot", "zapisana kopia dzienna nie przeszła sprawdzenia");
        return "error";
      }

      const fresh: SnapshotEntry = { file: name, ref: `${SNAPSHOT_DIR}/${name}`, kind: "daily", createdAt: header.createdAt, notes: header.notes, bytes: bytes.length, state: "ok", pinned: false, sha256: header.sha256 };
      // Najwyżej jedna przypięta: nowsza zastępuje starszą (starsza wraca do rotacji).
      if (pinLatest) entries = entries.map((e) => ({ ...e, pinned: e === latest }));
      entries = [fresh, ...entries];
      const drop = toDelete(entries);
      // Indeks (z przypięciem) przed usuwaniem; bez zapisanego indeksu nic nie znika — przypięta mogłaby wypaść.
      if (await writeIndex(env, folder, entries.filter((e) => !drop.includes(e)))) {
        for (const e of drop) await remove(folder, e.file);
      }
      try { localStorage.setItem(SNAPSHOT_LAST_KEY, JSON.stringify({ date: header.createdAt, notes: header.notes })); } catch { /* bez localStorage */ }
      return "written";
    } catch (err) {
      if (isQuota(err)) return "quota";
      logDiag("warn", "snapshot", "kopia dzienna nie powstała", err);
      return "error";
    }
  });
  const r = result ?? "busy";
  if (r !== "busy") saveStatus(now.getTime(), r);
  return r;
}

const BEFORE_PREFIX = "przed-przywroceniem-";
const p2 = (n: number) => String(n).padStart(2, "0");
const REF = /^(kopie-dzienne|kopie-przed-przywroceniem)\/([\w.-]+\.nkopia)$/;

/**
 * Treść kopii (update V2) po sprawdzeniu nagłówka, długości i skrótu — do przywracania (Z-16.1B). `ref` to
 * `katalog/plik` (`SnapshotEntry.ref`); inny kształt, uszkodzona albo nowszego formatu kopia — rzuca.
 */
export async function readSnapshotFile(ref: string, env: SnapshotEnv = browserEnv): Promise<{ header: SnapshotHeader; body: Uint8Array }> {
  const m = REF.exec(ref);
  if (!m) throw new Error("Zła nazwa kopii");
  const dir = await snapshotDir(env, m[1]);
  if (!dir) throw new Error("Kopie dzienne są niedostępne w tej przeglądarce");
  const file = m[2];
  const bytes = await readBytes(dir, file);
  const parsed = await parseSnapshot(bytes ?? new Uint8Array());
  if (parsed.state === "newer") throw new Error("Kopia jest zapisana przez nowszą wersję aplikacji");
  if (parsed.state !== "ok") throw new Error("Kopia jest uszkodzona");
  return { header: parsed.header, body: parsed.body };
}

/**
 * Kopia bieżącego stanu przed wymianą dokumentu (§1.6 p. 1), w osobnym katalogu poza rotacją. Zapis, odczyt
 * i sprawdzenie skrótu; kopie starsze niż 30 dni są przy okazji usuwane. Zwraca `ref`. Każdy błąd rzuca —
 * bez tej kopii wymiany nie wolno zacząć.
 */
export async function saveBeforeReplace(src: SnapshotSource, env: SnapshotEnv = browserEnv): Promise<string> {
  const dir = await snapshotDir(env, BEFORE_DIR);
  if (!dir) throw new Error("Brak miejsca na kopię w tej przeglądarce");
  const now = env.now();
  const stamp = (d: Date) => `${localDayKey(d)}-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
  const name = `${BEFORE_PREFIX}${stamp(now)}${EXT}`;
  const { bytes, header } = await encodeSnapshot(src.encode(), { createdAt: now.getTime(), notes: src.notes(), sv: await sha256Hex(src.stateVector()) });
  await env.write(dir, name, bytes);
  const check = await parseSnapshot((await readBytes(dir, name)) ?? new Uint8Array());
  if (check.state !== "ok" || check.header.sha256 !== header.sha256) {
    await remove(dir, name);
    throw new Error("Kopia obecnych danych nie przeszła sprawdzenia");
  }
  // Wiek z nazwy pliku (bez czytania i liczenia skrótu każdej kopii — mogą mieć dziesiątki MB).
  const cutoff = `${BEFORE_PREFIX}${stamp(new Date(now.getTime() - BEFORE_KEEP_MS))}`;
  for (const file of await fileNames(dir)) {
    if (file.startsWith(BEFORE_PREFIX) && file !== name && file < cutoff) await remove(dir, file);
  }
  return `${BEFORE_DIR}/${name}`;
}

/** Lista do Ustawień: kopie dzienne i kopie sprzed wymiany, od najnowszej; `null`, gdy OPFS niedostępny (funkcja ukryta). */
export async function listDailySnapshots(env: SnapshotEnv = browserEnv): Promise<SnapshotEntry[] | null> {
  try {
    const dir = await snapshotDir(env);
    if (!dir) return null;
    const before = await snapshotDir(env, BEFORE_DIR);
    const all = [...(await scan(dir)), ...(before ? await scan(before, "before") : [])];
    return all.sort((a, b) => b.createdAt - a.createdAt);
  } catch (err) {
    logDiag("info", "snapshot", "OPFS niedostępny", err);
    return null;
  }
}

/** Odpięcie (przypiętą usuwa tylko użytkownik — po odpięciu wraca do rotacji). Czeka na blokadę; `false` = nie zapisano. */
export async function unpinDailySnapshot(env: SnapshotEnv = browserEnv): Promise<boolean> {
  const dir = await snapshotDir(env);
  if (!dir) return false;
  return env.lockWait(async () => {
    const entries = (await scan(dir)).map((e) => ({ ...e, pinned: false }));
    return writeIndex(env, dir, entries);
  });
}

export function readSnapshotStatus(): SnapshotStatus | null {
  try {
    const v = JSON.parse(localStorage.getItem(SNAPSHOT_STATUS_KEY) ?? "null") as SnapshotStatus | null;
    return v && typeof v.at === "number" && typeof v.result === "string" ? v : null;
  } catch {
    return null;
  }
}

// ── przeglądarka ──

/** Bez odpowiedzi Workera w tym czasie zapis jest porażką — inaczej blokada kopii wisiałaby do zamknięcia karty. */
const WORKER_TIMEOUT_MS = 30_000;

async function writeInWorker(name: string, bytes: Uint8Array): Promise<void> {
  const worker = new Worker(new URL("../workers/snapshotWrite.worker.ts", import.meta.url), { type: "module" });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const reply = await new Promise<{ ok: boolean; name?: string; message?: string }>((resolve, reject) => {
      timer = setTimeout(() => reject(new Error("worker: brak odpowiedzi")), WORKER_TIMEOUT_MS);
      worker.onmessage = (e) => resolve(e.data);
      worker.onerror = (e) => reject(new Error(e.message || "worker"));
      worker.postMessage({ dir: SNAPSHOT_DIR, name, bytes });
    });
    if (!reply.ok) throw new DOMException(reply.message ?? "", reply.name ?? "Error");
  } finally {
    clearTimeout(timer);
    worker.terminate();
  }
}

export const browserEnv: SnapshotEnv = {
  async root() {
    if (typeof navigator === "undefined" || !navigator.storage?.getDirectory) return null;
    return navigator.storage.getDirectory();
  },
  now: () => new Date(),
  async write(dir, name, bytes) {
    const handle = await dir.getFileHandle(name, { create: true });
    const writable = (handle as unknown as { createWritable?: () => Promise<{ write(b: Uint8Array): Promise<void>; close(): Promise<void>; abort?(): Promise<void> }> }).createWritable;
    if (!writable) return writeInWorker(name, bytes);
    // Przeglądarka pisze do pliku tymczasowego i podmienia go przy `close()`.
    const stream = await writable.call(handle);
    try {
      await stream.write(bytes);
      await stream.close();
    } catch (err) {
      await stream.abort?.().catch(() => undefined);
      throw err;
    }
  },
  // Także blokada migracji: w trakcie przywracania kopii albo importu stan jest pośredni — kopia poczeka do następnej okazji.
  lock: (fn) => withLockIfFree(LOCK, () => withLockIfFree(MIGRATION_LOCK, fn)).then((r) => r ?? null),
  lockWait: (fn) => withExclusiveLock(LOCK, fn),
};

const yjsSource: SnapshotSource = {
  encode: () => yjsStore.encodeSyncState(),
  stateVector: () => yjsStore.encodeStateVector(),
  notes: () => yjsStore.notesMap.size,
  busy: () => yjsStore.isBulkWriting(),
};

/** Nieudane próby (błąd zapisu) w tej sesji — potem do jutra albo do ponownego otwarcia. */
const MAX_ERRORS = 3;
let started = false;
let doneDay: string | null = null;
let running = false;
let errors = 0;

/** Harmonogram (§1.4): 30 s po starcie, w bezczynności, i przy schowaniu karty — dopóki dzisiejszej nie ma. */
export function startDailySnapshots(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  const run = () => {
    const day = localDayKey();
    if (doneDay === day || running) return;
    running = true;
    void takeDailySnapshot(yjsSource)
      .then((r) => {
        // Brak miejsca kończy dzień (nie próbujemy przy każdym schowaniu karty); błąd — najwyżej MAX_ERRORS razy.
        if (r === "error") errors++;
        if (r !== "busy" && (r !== "error" || errors >= MAX_ERRORS)) doneDay = day;
      })
      .finally(() => { running = false; });
  };
  window.setTimeout(() => {
    if ("requestIdleCallback" in window) window.requestIdleCallback(run, { timeout: 10_000 });
    else run();
  }, 30_000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") run(); });
}
