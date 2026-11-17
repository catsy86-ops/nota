// Magazyn przekaźnika na dysku (F2, `docs/plan-fable-2026-11-15.md`): katalog na pokój, dziennik tylko do dopisywania.
//
//   data/rooms/<id>/room.json   { v, authHash, epoch, created } — tożsamość, zapisywana raz (atomowo) przy założeniu
//   data/rooms/<id>/meta.json   { v, last, count, bytes, touched, snapshot, logSize, blobs } — liczniki, z opóźnieniem
//   data/rooms/<id>/log.ndjson  jeden wpis na linię: {"seq":…,"at":…,"data":"…"} (migawka z "snapshot":true)
//   data/blobs/<id>/<blob>      bez zmian
//   data/trash/                 usuwane pokoje (zmiana nazwy, potem `rm`; resztki sprzątane przy starcie)
//
// Dziennik jest źródłem prawdy. `meta.json` to pamięć podręczna liczników: przy starcie, gdy brakuje go albo jego
// `logSize` nie zgadza się z rozmiarem dziennika (awaria po dopisaniu, przed zapisem liczników), liczniki są
// odtwarzane z dziennika, a urwana albo uszkodzona linia odrzucana. Tożsamość jest osobno, żeby brak `meta.json`
// nie gubił pokoju (bez skrótu tokenu pokoju nie da się otworzyć).
//
// Pamięć: przy starcie tylko `room.json` i `meta.json`. Wpisy pokoju trafiają do pamięci podręcznej LRU (limit bajtów)
// dopiero przy odczycie; pokój większy niż ćwierć limitu jest czytany strumieniem, bez wkładania do pamięci.
// Wszystkie operacje na jednym pokoju idą przez jego kolejkę (łańcuch obietnic); różne pokoje nie czekają na siebie.
// Każda operacja z kolejki sprawdza, że pokój to wciąż ten sam obiekt — po usunięciu (i ewentualnym założeniu od nowa)
// spóźniona operacja dostaje 404, zamiast pisać do cudzego dziennika albo wskrzeszać usunięty pokój.
import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { appendFile, mkdir, rename, rm, stat, statfs, truncate, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline";
import { once } from "node:events";
import { join } from "node:path";
import {
  LIMITS,
  applySnapshot,
  blobFits,
  cleanStore,
  commitAppend,
  emptyStore,
  expiredRooms,
  pageCollector,
  prepareAppend,
  validBlobId,
  validEpoch,
  validRoomId,
} from "./core.js";

const FORMAT = 1;
const FREE_CHECK_MS = 5000;
const META_DELAY_MS = 1000;
/** Narzut na wpis w pamięci podręcznej (obiekt, numer, czas) ponad długość danych. */
const ENTRY_OVERHEAD = 64;

/** Wolne bajty na dysku katalogu danych. */
async function diskFree(dir) {
  const s = await statfs(dir);
  return s.bavail * s.bsize;
}

/** Krótki opis błędu do logu: kod, bez komunikatu (ten zawiera pełną ścieżkę z identyfikatorem pokoju). */
const errCode = (e) => e?.code ?? e?.name ?? "błąd";
const short = (id) => `${id.slice(0, 8)}…`;

const lineOf = (entry) => `${JSON.stringify(entry)}\n`;

/** Wpis z linii dziennika albo `null` (uszkodzona). */
function parseLine(line) {
  try {
    const e = JSON.parse(line);
    if (!e || !Number.isSafeInteger(e.seq) || e.seq < 1 || typeof e.data !== "string") return null;
    const out = { seq: e.seq, data: e.data, at: Number.isFinite(e.at) ? e.at : 0 };
    if (e.snapshot === true) out.snapshot = true;
    return out;
  } catch {
    return null;
  }
}

/**
 * Czyta dziennik linia po linii. `visit(entry)` dostaje kolejne poprawne wpisy o rosnących numerach; zwrócenie
 * `false` przerywa czytanie. Wynik: czy dziennik jest czysty (każda linia poprawna, zakończona znakiem nowej linii,
 * numery rosnące) i jego rozmiar.
 */
async function readLog(path, visit) {
  let size;
  try {
    size = (await stat(path)).size;
  } catch (e) {
    if (e.code === "ENOENT") return { clean: true, size: 0 };
    throw e;
  }
  const input = createReadStream(path, { encoding: "utf8" });
  const rl = createInterface({ input, crlfDelay: Infinity });
  let offset = 0;
  let clean = true;
  let prev = 0;
  let stopped = false;
  try {
    for await (const line of rl) {
      // Dane są w ASCII (base64url + JSON), więc długość znakowa = bajtowa.
      offset += line.length + 1;
      const torn = offset > size; // ostatnia linia bez znaku nowej linii — zapis urwany
      const e = torn ? null : parseLine(line);
      if (!e || e.seq <= prev) {
        if (line.length || torn) clean = false;
        continue;
      }
      prev = e.seq;
      if (visit(e) === false) { stopped = true; break; }
    }
  } finally {
    rl.close();
    // `rl.close()` nie zamyka pliku pod spodem — bez tego każde wcześniejsze przerwanie zostawiało deskryptor.
    input.destroy();
  }
  return { clean: clean || stopped, size };
}

async function readAll(path) {
  const entries = [];
  const r = await readLog(path, (e) => { entries.push(e); });
  return { entries, clean: r.clean, size: r.size };
}

function writeAtomicSync(path, text) {
  writeFileSync(`${path}.tmp`, text);
  renameSync(`${path}.tmp`, path);
}

async function writeAtomic(path, text) {
  await writeFile(`${path}.tmp`, text);
  await rename(`${path}.tmp`, path);
}

/** Dziennik z listy wpisów: linia po linii do pliku tymczasowego (bez sklejania całości w jeden ciąg), potem zmiana nazwy. */
async function writeLogAtomic(path, entries) {
  const tmp = `${path}.tmp`;
  const out = createWriteStream(tmp);
  let size = 0;
  try {
    for (const e of entries) {
      const line = lineOf(e);
      size += Buffer.byteLength(line);
      if (!out.write(line)) await once(out, "drain");
    }
    out.end();
    await once(out, "finish");
  } catch (err) {
    out.destroy();
    await rm(tmp, { force: true });
    throw err;
  }
  await rename(tmp, path);
  return size;
}

/** Pamięć podręczna wpisów pokoi z limitem bajtów; najdawniej używany wypada pierwszy. */
class EntryCache {
  constructor(limit) {
    this.limit = limit;
    this.map = new Map(); // id → { entries, bytes }
    this.bytes = 0;
  }
  get(id) {
    const slot = this.map.get(id);
    if (!slot) return null;
    this.map.delete(id);
    this.map.set(id, slot);
    return slot.entries;
  }
  set(id, entries) {
    this.drop(id);
    const bytes = entries.reduce((n, e) => n + e.data.length + ENTRY_OVERHEAD, 0);
    if (bytes > this.limit) return;
    this.map.set(id, { entries, bytes });
    this.bytes += bytes;
    this.evict(id);
  }
  /** Dopisanie do wczytanego pokoju; niewczytany zostaje niewczytany. */
  push(id, entry) {
    const slot = this.map.get(id);
    if (!slot) return;
    slot.entries.push(entry);
    const add = entry.data.length + ENTRY_OVERHEAD;
    slot.bytes += add;
    this.bytes += add;
    this.evict(id);
  }
  drop(id) {
    const slot = this.map.get(id);
    if (!slot) return;
    this.map.delete(id);
    this.bytes -= slot.bytes;
  }
  evict(keep) {
    for (const id of this.map.keys()) {
      if (this.bytes <= this.limit) break;
      if (id !== keep) this.drop(id);
    }
    if (this.bytes > this.limit) this.drop(keep);
  }
}

/**
 * Otwiera magazyn w `dir`: przenosi stary `relay.json` (raz; zostaje jako `relay.json.bak`), sprząta resztki usuniętych
 * pokoi, wczytuje pokoje. `store.rooms[id]` to obiekty pokoi dla `core.js` (tożsamość + liczniki); `entries` w nich
 * nie ma — wpisy są na dysku i w pamięci podręcznej.
 */
export async function openStorage({ dir, cacheBytes = 256 * 1024 * 1024, maxTotalBytes = Infinity, minFreeBytes = 0, freeBytes = diskFree, now = Date.now, log = () => undefined }) {
  const roomsDir = join(dir, "rooms");
  const blobDir = join(dir, "blobs");
  const trashDir = join(dir, "trash");
  mkdirSync(roomsDir, { recursive: true });
  mkdirSync(blobDir, { recursive: true });
  const store = emptyStore();
  const cache = new EntryCache(cacheBytes);
  const queues = new Map();
  const dirty = new Set();
  const metaFailed = new Set();
  let metaTimer = null;
  let total = 0;

  const roomDir = (id) => join(roomsDir, id);
  const logPath = (id) => join(roomDir(id), "log.ndjson");
  const blobsOf = (room) => Object.values(room.blobs).reduce((n, b) => n + b, 0);
  const gone = { error: 404, message: "Nie ma takiego pokoju" };
  const full = { error: 507, message: "Przekaźnik pełny" };

  /** Kolejka pokoju: operacje wykonują się po kolei, błąd jednej nie blokuje następnych. */
  function queued(id, fn) {
    const prev = queues.get(id) ?? Promise.resolve();
    const run = prev.then(fn, fn);
    const tail = run.catch(() => undefined);
    queues.set(id, tail);
    void tail.then(() => { if (queues.get(id) === tail) queues.delete(id); });
    return run;
  }

  /** Operacja na konkretnym obiekcie pokoju: usunięty albo założony od nowa w międzyczasie → 404. */
  const forRoom = (id, room, fn) => queued(id, () => (store.rooms[id] === room ? fn() : gone));

  const metaOf = (room) => ({
    v: FORMAT, last: room.last, count: room.count, bytes: room.bytes, touched: room.touched,
    snapshot: room.snapshot, logSize: room.logSize, blobs: room.blobs,
  });

  function writeMeta(rid, room) {
    return queued(rid, async () => {
      if (store.rooms[rid] !== room) return;
      await writeAtomic(join(roomDir(rid), "meta.json"), JSON.stringify(metaOf(room)));
      metaFailed.delete(rid);
    });
  }

  function markDirty(id) {
    dirty.add(id);
    if (metaTimer) return;
    metaTimer = setTimeout(() => {
      metaTimer = null;
      const ids = [...dirty];
      dirty.clear();
      for (const rid of ids) {
        const room = store.rooms[rid];
        if (!room?.persisted) continue;
        void writeMeta(rid, room).catch((e) => {
          // Raz na pokój do skutku — bez zalewania logu co sekundę. Liczniki odtwarza i tak dziennik.
          if (!metaFailed.has(rid)) log(`Zapis liczników pokoju ${short(rid)} nieudany (${errCode(e)}), ponawiam`);
          metaFailed.add(rid);
          markDirty(rid);
        });
      }
    }, META_DELAY_MS);
    metaTimer.unref?.();
  }

  /** Przeniesienie do kosza (atomowe), potem usunięcie; przerwane `rm` sprząta następny start. */
  async function discard(path) {
    if (!existsSync(path)) return;
    await mkdir(trashDir, { recursive: true });
    const target = join(trashDir, `${randomBytes(8).toString("hex")}`);
    await rename(path, target);
    await rm(target, { recursive: true, force: true }).catch((e) => log(`Sprzątanie kosza nieudane (${errCode(e)})`));
  }

  /** Pierwszy zapis do pokoju: katalog i tożsamość na dysku, zanim pójdzie pierwsza linia dziennika. */
  async function persistRoom(id, room) {
    // Pokój z `openRoomForWrite` ma tablicę `entries` — `commitAppend` dopisywałby do niej każdy wpis i cały
    // dziennik siedziałby w pamięci. Wpisy żyją na dysku i w pamięci podręcznej.
    delete room.entries;
    if (room.persisted) return;
    // Resztki po pokoju o tym id (przerwane usuwanie) nie mogą się dokleić do nowego dziennika.
    await discard(roomDir(id));
    await mkdir(roomDir(id), { recursive: true });
    await writeAtomic(join(roomDir(id), "room.json"), JSON.stringify({ v: FORMAT, authHash: room.authHash, epoch: room.epoch, created: room.created }));
    room.persisted = true;
    room.logSize ??= 0;
  }

  // ── resztki usuniętych pokoi ──
  rmSync(trashDir, { recursive: true, force: true });

  // ── migracja z jednego pliku ──
  const legacy = join(dir, "relay.json");
  if (existsSync(legacy)) {
    let raw = null;
    try { raw = JSON.parse(readFileSync(legacy, "utf8")); } catch (e) { log(`Nie udało się wczytać relay.json (${errCode(e)})`); }
    if (raw) {
      const old = cleanStore(raw, now());
      for (const [id, room] of Object.entries(old.rooms)) {
        const rd = roomDir(id);
        // Pokój już przeniesiony (przerwana migracja albo wrócony stary plik) nie jest nadpisywany starszym stanem.
        if (existsSync(join(rd, "room.json"))) continue;
        mkdirSync(rd, { recursive: true });
        const text = room.entries.map(lineOf).join("");
        // Kolejność jak przy awarii: najpierw dziennik i tożsamość, liczniki na końcu.
        writeAtomicSync(join(rd, "log.ndjson"), text);
        writeAtomicSync(join(rd, "room.json"), JSON.stringify({ v: FORMAT, authHash: room.authHash, epoch: room.epoch, created: room.created }));
        writeAtomicSync(join(rd, "meta.json"), JSON.stringify({ ...metaOf(room), logSize: Buffer.byteLength(text) }));
      }
      const bak = existsSync(`${legacy}.bak`) ? `${legacy}.bak-${now()}` : `${legacy}.bak`;
      renameSync(legacy, bak);
      log(`Przeniesiono relay.json do katalogów pokoi (stary plik: ${bak.slice(dir.length + 1)})`);
    } else {
      // Nieczytelny plik nie znika i nie nadpisuje poprzedniej kopii — do ręcznego sprawdzenia.
      renameSync(legacy, `${legacy}.corrupt-${now()}`);
    }
  }

  // ── wczytanie pokoi ──
  for (const id of readdirSync(roomsDir)) {
    const rd = roomDir(id);
    if (!validRoomId(id)) continue;
    try {
      // Plik tymczasowy po przerwanej migawce albo zapisie liczników — prawdziwy plik jest nietknięty.
      for (const f of readdirSync(rd)) if (f.endsWith(".tmp")) rmSync(join(rd, f), { force: true });
    } catch (e) {
      log(`Pozycja ${short(id)} w rooms/ nie jest katalogiem pokoju (${errCode(e)})`);
      continue;
    }
    let identity;
    try {
      identity = JSON.parse(readFileSync(join(rd, "room.json"), "utf8"));
      if (typeof identity?.authHash !== "string" || !validEpoch(identity.epoch)) throw new Error("zła tożsamość");
    } catch (e) {
      // Katalog bez tożsamości to resztka (np. przerwane usuwanie) — bez skrótu tokenu i tak nie da się go otworzyć.
      log(`Pokój ${short(id)} bez tożsamości (${errCode(e)}), usuwam resztki`);
      rmSync(rd, { recursive: true, force: true });
      continue;
    }
    let meta = null;
    try { meta = JSON.parse(readFileSync(join(rd, "meta.json"), "utf8")); } catch { /* odtworzymy z dziennika */ }
    let size = 0;
    try { size = statSync(join(rd, "log.ndjson")).size; } catch { /* pusty pokój */ }
    const room = {
      authHash: identity.authHash, epoch: identity.epoch,
      created: Number.isFinite(identity.created) ? identity.created : now(),
      last: 0, count: 0, bytes: 0, touched: now(), snapshot: false, logSize: size, blobs: {}, persisted: true,
    };
    const metaOk = meta && meta.v === FORMAT && meta.logSize === size && Number.isSafeInteger(meta.last) && Number.isSafeInteger(meta.count) && Number.isSafeInteger(meta.bytes);
    if (metaOk) {
      Object.assign(room, { last: meta.last, count: meta.count, bytes: meta.bytes, snapshot: meta.snapshot === true, touched: Number.isFinite(meta.touched) ? meta.touched : room.touched });
    } else {
      const { entries, clean } = await readAll(join(rd, "log.ndjson"));
      if (!clean) {
        // Urwana ostatnia linia albo śmieci: dziennik od nowa z poprawnych wpisów (potwierdzone wpisy są całe).
        room.logSize = await writeLogAtomic(join(rd, "log.ndjson"), entries);
        log(`Pokój ${short(id)}: odrzucono uszkodzone linie dziennika`);
      }
      room.count = entries.length;
      room.bytes = entries.reduce((n, e) => n + e.data.length, 0);
      room.last = entries.length ? entries[entries.length - 1].seq : 0;
      room.snapshot = entries.some((e) => e.snapshot);
      const lastAt = entries.reduce((m, e) => Math.max(m, e.at), 0);
      room.touched = Math.max(Number.isFinite(meta?.touched) ? meta.touched : 0, lastAt) || room.created;
      if (Number.isSafeInteger(meta?.last) && meta.last > room.last) room.last = meta.last; // numeracja się nie cofa
    }
    // Bloby zawsze z katalogu: plik po zmianie nazwy jest kompletny, a liczniki mogły nie zdążyć się zapisać.
    if (existsSync(join(blobDir, id))) {
      for (const f of readdirSync(join(blobDir, id))) {
        const p = join(blobDir, id, f);
        if (f.endsWith(".tmp")) { rmSync(p, { force: true }); continue; }
        if (!validBlobId(f)) continue;
        const n = statSync(p).size;
        if (n > 0) room.blobs[f] = n;
      }
    }
    store.rooms[id] = room;
    total += room.logSize + blobsOf(room);
    if (!metaOk) markDirty(id);
  }

  // Bloby pokoi, których nie ma (przerwane usuwanie) — nie da się ich ani pobrać, ani rozliczyć.
  for (const id of readdirSync(blobDir)) {
    if (!store.rooms[id]) rmSync(join(blobDir, id), { recursive: true, force: true });
  }

  /** Wpisy pokoju z pamięci podręcznej albo z dysku (mały pokój trafia do pamięci podręcznej). W kolejce pokoju. */
  async function loadEntries(id) {
    const hit = cache.get(id);
    if (hit) return hit;
    const { entries } = await readAll(logPath(id));
    cache.set(id, entries);
    return entries;
  }

  // Wolne miejsce na dysku (S4.4): odczyt najwyżej co FREE_CHECK_MS — dopisanie zostaje tanie.
  let freeAt = -Infinity;
  let freeKnown = Infinity;
  async function roomOnDisk(add) {
    if (!minFreeBytes) return true;
    if (now() - freeAt > FREE_CHECK_MS) {
      freeAt = now();
      try { freeKnown = await freeBytes(dir); } catch (e) { freeKnown = Infinity; log(`Nie da się sprawdzić wolnego miejsca (${errCode(e)})`); }
    }
    if (freeKnown - add < minFreeBytes) return false;
    freeKnown -= add;
    return true;
  }

  /**
   * Rezerwacja miejsca przed zapisem (limit łączny i wolny dysk): licznik rośnie **przed** `await`, więc równoległe
   * zapisy do różnych pokoi nie przekroczą limitu. Zwraca funkcję zwalniającą rezerwację po nieudanym zapisie.
   */
  async function reserve(add) {
    if (total + add > maxTotalBytes) return null;
    total += add;
    if (await roomOnDisk(add)) return () => { total -= add; };
    total -= add;
    return null;
  }

  async function removeRoom(id, room) {
    delete store.rooms[id];
    total -= (room.logSize ?? 0) + blobsOf(room);
    cache.drop(id);
    dirty.delete(id);
    // Najpierw zmiana nazwy (atomowa): przerwane usuwanie nie zostawia dziennika, który dokleiłby się do nowego pokoju.
    await discard(roomDir(id));
    await discard(join(blobDir, id));
  }

  return {
    store,
    get totalBytes() { return total; },
    get cachedBytes() { return cache.bytes; },
    blobPath: (id, blobId) => {
      if (!validRoomId(id) || !validBlobId(blobId)) throw new Error("zły identyfikator");
      return join(blobDir, id, blobId);
    },

    /** Dopisanie: linia na dysk, dopiero potem liczniki w pamięci. Błąd zapisu cofa dziennik do poprzedniej długości. */
    append(id, room, data, at) {
      return forRoom(id, room, async () => {
        const p = prepareAppend(room, data, at);
        if (p.error) return p;
        const line = lineOf(p.entry);
        const add = Buffer.byteLength(line);
        const release = await reserve(add);
        if (!release) return full;
        const before = room.logSize ?? 0;
        try {
          await persistRoom(id, room);
          await appendFile(logPath(id), line);
        } catch (e) {
          release();
          // Pół linii na końcu zepsułoby następny wpis — przycinamy do znanej długości.
          if (room.persisted) await truncate(logPath(id), before).catch(() => undefined);
          throw e;
        }
        room.logSize = before + add;
        commitAppend(room, p.entry);
        cache.push(id, p.entry);
        markDirty(id);
        return { seq: p.entry.seq };
      });
    },

    /** Migawka: nowy dziennik w pliku tymczasowym (strumieniem), zmiana nazwy, liczniki od razu. */
    snapshot(id, room, upto, data, at) {
      return forRoom(id, room, async () => {
        const entries = await loadEntries(id);
        const work = { ...room, entries: entries.slice() };
        const s = applySnapshot(work, upto, data, at);
        if (s.error) return s;
        const estimate = work.entries.reduce((n, e) => n + e.data.length + 64, 0);
        const release = await reserve(estimate);
        if (!release) return full;
        let size;
        try {
          size = await writeLogAtomic(logPath(id), work.entries);
        } finally {
          release();
        }
        total += size - room.logSize;
        Object.assign(room, { count: work.count, bytes: work.bytes, snapshot: true, touched: work.touched, logSize: size });
        cache.set(id, work.entries);
        await writeAtomic(join(roomDir(id), "meta.json"), JSON.stringify(metaOf(room)));
        dirty.delete(id);
        return s;
      });
    },

    /** Wpisy po numerze `since`: najwyżej `LIMITS.PAGE` wpisów i `LIMITS.PAGE_CHARS` znaków — jak `entriesSince`. */
    read(id, room, since) {
      return forRoom(id, room, async () => {
        const n = Number.isSafeInteger(since) && since >= 0 ? since : 0;
        if (!room.persisted) return { entries: [], last: room.last, epoch: room.epoch, hasMore: false };
        const page = pageCollector(n);
        if (cache.get(id) || room.logSize <= cache.limit / 4) {
          for (const e of await loadEntries(id)) if (page.take(e) === false) break;
        } else {
          // Duży pokój: strumień, bez wkładania całości do pamięci.
          await readLog(logPath(id), (e) => page.take(e));
        }
        return { entries: page.entries, last: room.last, epoch: room.epoch, hasMore: page.hasMore };
      });
    },

    /** Blob: limity pokoju sprawdzane w kolejce (równoległe wysyłki nie przekroczą), plik przez plik tymczasowy. */
    putBlob(id, room, blobId, bytes) {
      return forRoom(id, room, async () => {
        const fit = blobFits(room, blobId, bytes.length);
        if (fit.error) return fit;
        if (fit.existing) return { ok: true, existing: true };
        const release = await reserve(bytes.length);
        if (!release) return full;
        try {
          await persistRoom(id, room);
          await mkdir(join(blobDir, id), { recursive: true });
          await writeAtomic(join(blobDir, id, blobId), bytes);
        } catch (e) {
          release();
          throw e;
        }
        room.blobs[blobId] = bytes.length;
        markDirty(id);
        return { ok: true, existing: false };
      });
    },

    /** Usunięcie pokoju (DELETE z tokenem). `room` — obiekt sprawdzony przez wołającego; inny w kolejce → nic. */
    deleteRoom(id, room = store.rooms[id]) {
      return queued(id, async () => {
        if (!room || store.rooms[id] !== room) return false;
        await removeRoom(id, room);
        return true;
      });
    },

    /** Wygasłe pokoje (TTL, młode — `expiredRooms`) znikają razem z blobami; wygaśnięcie sprawdzane jeszcze raz w kolejce. */
    async expire(at) {
      const out = [];
      for (const id of expiredRooms(store, at)) {
        const room = store.rooms[id];
        const removed = await queued(id, async () => {
          if (store.rooms[id] !== room || !expiredRooms({ rooms: { [id]: room } }, at).length) return false;
          await removeRoom(id, room);
          return true;
        });
        if (removed) out.push(id);
      }
      return out;
    },

    /** Zamknięcie procesu: liczniki zmienionych pokoi synchronicznie na dysk. */
    flushSync() {
      if (metaTimer) clearTimeout(metaTimer);
      metaTimer = null;
      for (const id of dirty) {
        const room = store.rooms[id];
        if (room?.persisted) writeAtomicSync(join(roomDir(id), "meta.json"), JSON.stringify(metaOf(room)));
      }
      dirty.clear();
    },

    /** Dla testów: wszystkie zaplanowane zapisy liczników od razu. */
    async flushMeta() {
      const ids = [...dirty];
      dirty.clear();
      if (metaTimer) { clearTimeout(metaTimer); metaTimer = null; }
      await Promise.all(ids.map((rid) => (store.rooms[rid]?.persisted ? writeMeta(rid, store.rooms[rid]) : null)));
    },
  };
}
