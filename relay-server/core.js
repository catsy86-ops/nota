// Czysta logika przekaźnika synchronizacji. Bez I/O i bez czasu w środku (czas przychodzi
// jako argument), żeby dało się ją testować. Serwer widzi tylko: identyfikator pokoju,
// hash tokenu dostępu, zaszyfrowane bloby (base64url), numery kolejne i czasy.
import { createHash, timingSafeEqual } from "node:crypto";

export const LIMITS = {
  MAX_ENTRY_CHARS: 700_000, // ~512 KB po odkodowaniu
  MAX_ROOM_CHARS: 50_000_000, // suma zaszyfrowanych danych jednego pokoju
  MAX_ENTRIES: 5_000, // wpisów w logu jednego pokoju; powyżej — klient musi zrobić snapshot
  MAX_ROOMS: 5_000,
  ROOM_TTL_MS: 180 * 24 * 3600 * 1000, // pokój bez zapisu dłużej niż pół roku znika
  PAGE: 500, // wpisów w jednej odpowiedzi GET
};

const ROOM_ID = /^[a-f0-9]{64}$/;
const TOKEN = /^[A-Za-z0-9_-]{43}$/; // 32 bajty w base64url
const BASE64URL = /^[A-Za-z0-9_-]+$/;

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
export function cleanStore(raw, now) {
  const store = emptyStore();
  if (!raw || typeof raw !== "object" || !raw.rooms || typeof raw.rooms !== "object") return store;
  for (const [id, room] of Object.entries(raw.rooms)) {
    if (!validRoomId(id) || !room || typeof room.authHash !== "string") continue;
    const entries = Array.isArray(room.entries)
      ? room.entries.filter((e) => e && Number.isSafeInteger(e.seq) && e.seq > 0 && typeof e.data === "string")
      : [];
    store.rooms[id] = {
      authHash: room.authHash,
      last: Number.isSafeInteger(room.last) ? room.last : 0,
      touched: Number.isFinite(room.touched) ? room.touched : now,
      entries,
    };
  }
  return store;
}

export function roomBytes(room) {
  return room.entries.reduce((n, e) => n + e.data.length, 0);
}

/** Pokój do zapisu: tworzy go przy pierwszym zapisie (token staje się kluczem pokoju). */
export function openRoomForWrite(store, id, token, now) {
  if (!validRoomId(id)) return { error: 400, message: "Zły identyfikator pokoju" };
  if (!validToken(token)) return { error: 401, message: "Brak tokenu" };
  let room = store.rooms[id];
  if (!room) {
    if (Object.keys(store.rooms).length >= LIMITS.MAX_ROOMS) return { error: 507, message: "Serwer pełny" };
    room = { authHash: hashToken(token), last: 0, touched: now, entries: [] };
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

/** Dopisuje zaszyfrowany wpis; zwraca jego numer. */
export function appendEntry(room, data, now) {
  if (!validEntry(data)) return { error: 413, message: "Wpis ma zły rozmiar lub format" };
  if (room.entries.length >= LIMITS.MAX_ENTRIES) return { error: 409, message: "Log pełny — zrób snapshot" };
  if (roomBytes(room) + data.length > LIMITS.MAX_ROOM_CHARS) return { error: 413, message: "Pokój pełny — zrób snapshot" };
  room.last += 1;
  room.entries.push({ seq: room.last, data, at: now });
  room.touched = now;
  return { seq: room.last };
}

/**
 * Snapshot: wpisy o numerach ≤ upto zastępuje jednym wpisem o numerze upto.
 * Klient, który był na upto, nie dostaje nic nowego; świeższe wpisy zostają.
 */
export function applySnapshot(room, upto, data, now) {
  if (!validEntry(data)) return { error: 413, message: "Snapshot ma zły rozmiar lub format" };
  if (!Number.isSafeInteger(upto) || upto < 1 || upto > room.last) return { error: 400, message: "Zły numer snapshotu" };
  const rest = room.entries.filter((e) => e.seq > upto);
  room.entries = [{ seq: upto, data, at: now, snapshot: true }, ...rest];
  room.touched = now;
  return { seq: upto };
}

/** Wpisy po numerze `since` (strictly greater), najwyżej PAGE. */
export function entriesSince(room, since) {
  const n = Number.isSafeInteger(since) && since >= 0 ? since : 0;
  const entries = room.entries.filter((e) => e.seq > n).slice(0, LIMITS.PAGE);
  return { entries, last: room.last, hasMore: room.entries.some((e) => e.seq > n) && entries.length === LIMITS.PAGE };
}

/** Parsuje `since` z query stringu; wszystko, co nie jest liczbą ≥ 0, to 0. */
export function parseSince(raw) {
  const n = Number(raw ?? 0);
  return Number.isSafeInteger(n) && n >= 0 ? n : 0;
}

export function validEntry(data) {
  return typeof data === "string" && data.length > 0 && data.length <= LIMITS.MAX_ENTRY_CHARS && BASE64URL.test(data);
}

/** Pokoje, których nie dotykano dłużej niż ROOM_TTL_MS. */
export function expiredRooms(store, now) {
  return Object.entries(store.rooms)
    .filter(([, room]) => now - room.touched > LIMITS.ROOM_TTL_MS)
    .map(([id]) => id);
}
