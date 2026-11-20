// Czysta logika przekaźnika synchronizacji. Bez I/O i bez czasu w środku (czas przychodzi
// jako argument), żeby dało się ją testować. Serwer widzi tylko: identyfikator pokoju,
// hash tokenu dostępu, zaszyfrowane bloby (base64url), numery kolejne i czasy.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const LIMITS = {
  MAX_ENTRY_CHARS: 22_400_000, // ~16 MB po odkodowaniu (wpis i migawka)
  MAX_ROOM_CHARS: 50_000_000, // suma zaszyfrowanych danych jednego pokoju
  MAX_ENTRIES: 5_000, // wpisów w logu jednego pokoju; powyżej — klient musi zrobić snapshot
  MAX_ROOMS: 5_000,
  ROOM_TTL_MS: 180 * 24 * 3600 * 1000, // pokój bez zapisu dłużej niż pół roku znika
  PAGE: 500, // wpisów w jednej odpowiedzi GET
  PAGE_CHARS: 32_000_000, // znaków danych w jednej odpowiedzi GET (zawsze co najmniej jeden wpis)
  MAX_BLOB_BYTES: 24 * 1024 * 1024, // zaszyfrowany obraz/załącznik (plaintext do 20 MB + narzut)
  MAX_ROOM_BLOB_BYTES: 300 * 1024 * 1024,
  MAX_BLOBS: 5_000,
  // Młody pokój (bez migawki, z mniej niż YOUNG_MAX_ENTRIES wpisami) wygasa po dobie bez zapisu, nie po pół roku (F2).
  YOUNG_TTL_MS: 24 * 3600 * 1000,
  YOUNG_MAX_ENTRIES: 2,
};

const ROOM_ID = /^[a-f0-9]{64}$/;
const TOKEN = /^[A-Za-z0-9_-]{43}$/; // 32 bajty w base64url
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const BLOB_ID = /^[a-f0-9]{64}$/;
const EPOCH = /^[a-f0-9]{32}$/;

/**
 * Epoka pokoju: losowy znacznik nadawany przy założeniu. Pokój usunięty i założony od nowa (albo
 * odtworzony po utracie danych) ma inną epokę, więc klient ze starym kursorem widzi, że numery wpisów
 * zaczęły się od początku, i wysyła pełny stan zamiast samej różnicy.
 */
export const newEpoch = () => randomBytes(16).toString("hex");

export function validBlobId(id) {
  return typeof id === "string" && BLOB_ID.test(id);
}

/** Czy blob o tym id i rozmiarze zmieści się w pokoju. Istniejący blob nie liczy się drugi raz. */
export function blobFits(room, id, size) {
  const blobs = room.blobs ?? {};
  if (id in blobs) return { ok: true, existing: true };
  if (!Number.isSafeInteger(size) || size <= 0 || size > LIMITS.MAX_BLOB_BYTES) return { error: 413, message: "Blob ma zły rozmiar" };
  if (Object.keys(blobs).length >= LIMITS.MAX_BLOBS) return { error: 507, message: "Za dużo blobów w pokoju" };
  const used = Object.values(blobs).reduce((n, b) => n + b, 0);
  if (used + size > LIMITS.MAX_ROOM_BLOB_BYTES) return { error: 507, message: "Pokój pełny" };
  return { ok: true, existing: false };
}

export function validRoomId(id) {
  return typeof id === "string" && ROOM_ID.test(id);
}

export function validToken(token) {
  return typeof token === "string" && TOKEN.test(token);
}

/** Hash tokenu zapisywany na serwerze. Sam token nigdy nie trafia do pliku danych. */
export function hashToken(token) {
  return createHash("sha256").update(token).digest("base64url");
}

export function tokenMatches(storedHash, token) {
  if (typeof storedHash !== "string" || !validToken(token)) return false;
  const a = Buffer.from(storedHash);
  const b = Buffer.from(hashToken(token));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function emptyStore() {
  return { rooms: {} };
}

/** Odtwarza magazyn z pliku, odrzucając wpisy, których nie da się bezpiecznie użyć. */
export function cleanStore(raw, now, makeEpoch = newEpoch) {
  const store = emptyStore();
  if (!raw || typeof raw !== "object" || !raw.rooms || typeof raw.rooms !== "object") return store;
  for (const [id, room] of Object.entries(raw.rooms)) {
    if (!validRoomId(id) || !room || typeof room.authHash !== "string") continue;
    const entries = Array.isArray(room.entries)
      ? room.entries.filter((e) => e && Number.isSafeInteger(e.seq) && e.seq > 0 && typeof e.data === "string")
      : [];
    const blobs = {};
    if (room.blobs && typeof room.blobs === "object") {
      for (const [bid, size] of Object.entries(room.blobs)) {
        if (validBlobId(bid) && Number.isSafeInteger(size) && size > 0) blobs[bid] = size;
      }
    }
    const touched = Number.isFinite(room.touched) ? room.touched : now;
    store.rooms[id] = {
      authHash: room.authHash,
      // Pokój sprzed epok dostaje ją przy wczytaniu; serwer zapisuje magazyn zaraz po starcie.
      epoch: validEpoch(room.epoch) ? room.epoch : makeEpoch(),
      last: Number.isSafeInteger(room.last) ? room.last : 0,
      touched,
      created: Number.isFinite(room.created) ? room.created : touched,
      entries,
      count: entries.length,
      bytes: entries.reduce((n, e) => n + e.data.length, 0),
      snapshot: entries.some((e) => e.snapshot === true),
      blobs,
    };
  }
  return store;
}

export function validEpoch(epoch) {
  return typeof epoch === "string" && EPOCH.test(epoch);
}

/** Suma znaków wpisów liczona od zera — tylko do sprawdzeń; serwer prowadzi `room.bytes` przyrostowo. */
export function roomBytes(room) {
  return room.entries.reduce((n, e) => n + e.data.length, 0);
}

const countOf = (room) => room.count ?? room.entries?.length ?? 0;
const bytesOf = (room) => room.bytes ?? (room.entries ? roomBytes(room) : 0);

/** Pokój do zapisu: tworzy go przy pierwszym zapisie (token staje się kluczem pokoju). */
export function openRoomForWrite(store, id, token, now, makeEpoch = newEpoch) {
  if (!validRoomId(id)) return { error: 400, message: "Zły identyfikator pokoju" };
  if (!validToken(token)) return { error: 401, message: "Brak tokenu" };
  let room = store.rooms[id];
  if (!room) {
    if (Object.keys(store.rooms).length >= LIMITS.MAX_ROOMS) return { error: 507, message: "Serwer pełny" };
    room = { authHash: hashToken(token), epoch: makeEpoch(), last: 0, touched: now, created: now, entries: [], count: 0, bytes: 0, snapshot: false, blobs: {} };
    store.rooms[id] = room;
  } else if (!tokenMatches(room.authHash, token)) {
    return { error: 403, message: "Zły token" };
  }
  return { room };
}

/** Pokój do odczytu: bez tworzenia; nieznany pokój to 404, zły token to 403. */
export function openRoomForRead(store, id, token) {
  if (!validRoomId(id)) return { error: 400, message: "Zły identyfikator pokoju" };
  if (!validToken(token)) return { error: 401, message: "Brak tokenu" };
  const room = store.rooms[id];
  if (!room) return { error: 404, message: "Nie ma takiego pokoju" };
  if (!tokenMatches(room.authHash, token)) return { error: 403, message: "Zły token" };
  return { room };
}

/**
 * Klient podał epokę, którą zna, a pokoju nie ma albo ma inną: jego kursor i różnica dotyczą pokoju,
 * który już nie istnieje. Odpowiedź 412 każe mu zacząć od pełnego stanu. Klient bez epoki (stary albo
 * świeżo po resecie) przechodzi.
 */
export function epochConflict(room, epoch) {
  if (typeof epoch !== "string") return null;
  if (room && room.epoch === epoch) return null;
  return { error: 412, message: "Pokój został założony od nowa" };
}

/**
 * Sprawdza wpis i składa go z następnym numerem, **bez** zmiany pokoju — serwer najpierw zapisuje go na dysk,
 * dopiero potem zatwierdza (`commitAppend`). Koszt nie zależy od rozmiaru pokoju (liczniki przyrostowe).
 */
export function prepareAppend(room, data, now) {
  if (!validEntry(data)) return { error: 413, message: "Wpis ma zły rozmiar lub format" };
  if (countOf(room) >= LIMITS.MAX_ENTRIES) return { error: 409, message: "Log pełny — zrób snapshot" };
  if (bytesOf(room) + data.length > LIMITS.MAX_ROOM_CHARS) return { error: 409, message: "Pokój pełny — zrób snapshot" };
  return { entry: { seq: room.last + 1, data, at: now } };
}

/** Zatwierdza wpis z `prepareAppend` w pamięci pokoju. `entries` (jeśli wczytane) dostaje go na końcu. */
export function commitAppend(room, entry) {
  room.count = countOf(room) + 1;
  room.bytes = bytesOf(room) + entry.data.length;
  room.last = entry.seq;
  room.touched = entry.at;
  if (Array.isArray(room.entries)) room.entries.push(entry);
}

/** Dopisuje zaszyfrowany wpis; zwraca jego numer. */
export function appendEntry(room, data, now) {
  const p = prepareAppend(room, data, now);
  if (p.error) return p;
  commitAppend(room, p.entry);
  return { seq: room.last };
}

/**
 * Snapshot: wpisy o numerach ≤ upto zastępuje jednym wpisem o numerze upto.
 * Klient, który był na upto, nie dostaje nic nowego; świeższe wpisy zostają.
 * Wymaga wczytanych `room.entries`; liczniki są przeliczane z nowej listy.
 */
export function applySnapshot(room, upto, data, now) {
  if (!validEntry(data)) return { error: 413, message: "Snapshot ma zły rozmiar lub format" };
  if (!Number.isSafeInteger(upto) || upto < 1 || upto > room.last) return { error: 400, message: "Zły numer snapshotu" };
  // Migawka poniżej pierwszego zachowanego wpisu niczego by nie zastąpiła, tylko dołożyła — pokój rósłby bez limitu.
  if (room.entries.length && upto < room.entries[0].seq) return { error: 409, message: "Snapshot starszy niż log" };
  const rest = room.entries.filter((e) => e.seq > upto);
  const size = rest.reduce((n, e) => n + e.data.length, data.length);
  if (size > LIMITS.MAX_ROOM_CHARS) return { error: 413, message: "Pokój pełny" };
  room.entries = [{ seq: upto, data, at: now, snapshot: true }, ...rest];
  room.count = room.entries.length;
  room.bytes = roomBytes(room);
  room.snapshot = true;
  room.touched = now;
  return { seq: upto };
}

/**
 * Strona wpisów: po numerze `n` (ściśle większe), najwyżej PAGE wpisów i PAGE_CHARS znaków danych — zawsze co
 * najmniej jeden wpis, żeby wpis większy niż budżet dało się pobrać. `take(e)` zwraca `false`, gdy strona pełna.
 */
export function pageCollector(n) {
  const entries = [];
  let chars = 0;
  let hasMore = false;
  return {
    entries,
    get hasMore() { return hasMore; },
    take(e) {
      if (e.seq <= n) return true;
      if (entries.length >= LIMITS.PAGE || (entries.length && chars + e.data.length > LIMITS.PAGE_CHARS)) { hasMore = true; return false; }
      entries.push(e);
      chars += e.data.length;
      return true;
    },
  };
}

/** Wpisy po numerze `since` (strictly greater), najwyżej PAGE (i PAGE_CHARS znaków). */
export function entriesSince(room, since) {
  const n = Number.isSafeInteger(since) && since >= 0 ? since : 0;
  const page = pageCollector(n);
  for (const e of room.entries) if (page.take(e) === false) break;
  return { entries: page.entries, last: room.last, epoch: room.epoch, hasMore: page.hasMore };
}

/** Parsuje `since` z query stringu; wszystko, co nie jest liczbą ≥ 0, to 0. */
export function parseSince(raw) {
  const n = Number(raw ?? 0);
  return Number.isSafeInteger(n) && n >= 0 ? n : 0;
}

export function validEntry(data) {
  return typeof data === "string" && data.length > 0 && data.length <= LIMITS.MAX_ENTRY_CHARS && BASE64URL.test(data);
}

/**
 * Pokoje, których nie dotykano dłużej niż ROOM_TTL_MS, oraz młode pokoje (bez migawki, z mniej niż
 * YOUNG_MAX_ENTRIES wpisami) bez zapisu dłużej niż YOUNG_TTL_MS. Młody pokój zniknięty za wcześnie nie gubi
 * danych: klient dostaje 404, zakłada pokój od nowa z nową epoką i wysyła pełny stan (Z-5.5).
 */
export function expiredRooms(store, now) {
  return Object.entries(store.rooms)
    .filter(([, room]) => {
      const idle = now - room.touched;
      if (idle > LIMITS.ROOM_TTL_MS) return true;
      return !room.snapshot && countOf(room) < LIMITS.YOUNG_MAX_ENTRIES && idle > LIMITS.YOUNG_TTL_MS;
    })
    .map(([id]) => id);
}
