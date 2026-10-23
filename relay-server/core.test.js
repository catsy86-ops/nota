import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  LIMITS,
  appendEntry,
  applySnapshot,
  cleanStore,
  emptyStore,
  entriesSince,
  expiredRooms,
  hashToken,
  openRoomForRead,
  openRoomForWrite,
  parseSince,
  validRoomId,
  validToken,
  validBlobId,
  blobFits,
} from "./core.js";

const ROOM = "a".repeat(64);
const TOKEN = randomBytes(32).toString("base64url");
const OTHER = randomBytes(32).toString("base64url");
const NOW = 1_700_000_000_000;
const blob = (n = 16) => "A".repeat(n);

function writable() {
  const store = emptyStore();
  const { room } = openRoomForWrite(store, ROOM, TOKEN, NOW);
  return { store, room };
}

test("identyfikator pokoju: tylko 64 cyfry szesnastkowe małymi literami", () => {
  assert.equal(validRoomId(ROOM), true);
  assert.equal(validRoomId("A".repeat(64)), false);
  assert.equal(validRoomId("a".repeat(63)), false);
  assert.equal(validRoomId(null), false);
});

test("token: 32 bajty w base64url, inaczej odrzucany", () => {
  assert.equal(validToken(TOKEN), true);
  assert.equal(validToken("krótki"), false);
  assert.equal(validToken(TOKEN + "="), false);
  assert.equal(validToken(undefined), false);
});

test("serwer przechowuje hash tokenu, nie sam token", () => {
  const { room } = writable();
  assert.equal(room.authHash, hashToken(TOKEN));
  assert.notEqual(room.authHash, TOKEN);
});

test("pierwszy zapis zakłada pokój, kolejne wymagają tego samego tokenu", () => {
  const { store } = writable();
  assert.equal(openRoomForWrite(store, ROOM, TOKEN, NOW).error, undefined);
  assert.equal(openRoomForWrite(store, ROOM, OTHER, NOW).error, 403);
  assert.equal(openRoomForWrite(store, ROOM, "zły", NOW).error, 401);
  assert.equal(openRoomForWrite(store, "xyz", TOKEN, NOW).error, 400);
});

test("odczyt: nieznany pokój 404, zły token 403, dobry token przechodzi", () => {
  const { store } = writable();
  assert.equal(openRoomForRead(emptyStore(), ROOM, TOKEN).error, 404);
  assert.equal(openRoomForRead(store, ROOM, OTHER).error, 403);
  assert.equal(openRoomForRead(store, ROOM, TOKEN).error, undefined);
});

test("odczyt nie zakłada pokoju", () => {
  const store = emptyStore();
  openRoomForRead(store, ROOM, TOKEN);
  assert.deepEqual(store.rooms, {});
});

test("limit liczby pokoi", () => {
  const store = emptyStore();
  for (let i = 0; i < LIMITS.MAX_ROOMS; i++) store.rooms[i.toString(16).padStart(64, "0")] = { authHash: "x", last: 0, touched: NOW, entries: [] };
  assert.equal(openRoomForWrite(store, ROOM, TOKEN, NOW).error, 507);
});

test("wpisy dostają rosnące numery od 1", () => {
  const { room } = writable();
  assert.deepEqual(appendEntry(room, blob(), NOW), { seq: 1 });
  assert.deepEqual(appendEntry(room, blob(), NOW), { seq: 2 });
  assert.equal(room.last, 2);
});

test("wpis musi być base64url i mieścić się w limicie", () => {
  const { room } = writable();
  assert.equal(appendEntry(room, "", NOW).error, 413);
  assert.equal(appendEntry(room, "ab cd", NOW).error, 413);
  assert.equal(appendEntry(room, "A".repeat(LIMITS.MAX_ENTRY_CHARS + 1), NOW).error, 413);
  assert.equal(appendEntry(room, 42, NOW).error, 413);
});

test("log pełny: po MAX_ENTRIES zapis odrzucany, aż klient zrobi snapshot", () => {
  const { room } = writable();
  for (let i = 0; i < LIMITS.MAX_ENTRIES; i++) appendEntry(room, blob(4), NOW);
  assert.equal(appendEntry(room, blob(), NOW).error, 409);
});

test("snapshot zastępuje wpisy do numeru upto, nowsze zostają", () => {
  const { room } = writable();
  for (let i = 0; i < 5; i++) appendEntry(room, `${i}`.padEnd(4, "A"), NOW);
  assert.deepEqual(applySnapshot(room, 3, "SNAP", NOW), { seq: 3 });
  assert.deepEqual(room.entries.map((e) => e.seq), [3, 4, 5]);
  assert.equal(room.entries[0].data, "SNAP");
  assert.equal(room.entries[0].snapshot, true);
  assert.equal(room.last, 5, "numeracja się nie cofa");
});

test("snapshot na świeżym numerze po kompaktowaniu nie zrywa kolejnych zapisów", () => {
  const { room } = writable();
  for (let i = 0; i < 3; i++) appendEntry(room, blob(), NOW);
  applySnapshot(room, 3, "SNAP", NOW);
  assert.deepEqual(appendEntry(room, blob(), NOW), { seq: 4 });
  assert.deepEqual(room.entries.map((e) => e.seq), [3, 4]);
});

test("snapshot poza zakresem to 400", () => {
  const { room } = writable();
  appendEntry(room, blob(), NOW);
  assert.equal(applySnapshot(room, 0, blob(), NOW).error, 400);
  assert.equal(applySnapshot(room, 2, blob(), NOW).error, 400);
  assert.equal(applySnapshot(room, 1.5, blob(), NOW).error, 400);
  assert.equal(applySnapshot(room, 1, "", NOW).error, 413);
});

test("odczyt po numerze: tylko nowsze, z numerem ostatniego", () => {
  const { room } = writable();
  for (let i = 0; i < 4; i++) appendEntry(room, blob(), NOW);
  const r = entriesSince(room, 2);
  assert.deepEqual(r.entries.map((e) => e.seq), [3, 4]);
  assert.equal(r.last, 4);
  assert.equal(r.hasMore, false);
});

test("odczyt stronicowany: hasMore gdy strona pełna i są kolejne", () => {
  const { room } = writable();
  for (let i = 0; i < LIMITS.PAGE + 3; i++) appendEntry(room, blob(4), NOW);
  const first = entriesSince(room, 0);
  assert.equal(first.entries.length, LIMITS.PAGE);
  assert.equal(first.hasMore, true);
  const second = entriesSince(room, LIMITS.PAGE);
  assert.equal(second.entries.length, 3);
  assert.equal(second.hasMore, false);
});

test("parseSince: śmieci dają 0", () => {
  assert.equal(parseSince("12"), 12);
  assert.equal(parseSince("-3"), 0);
  assert.equal(parseSince("abc"), 0);
  assert.equal(parseSince(undefined), 0);
  assert.equal(parseSince("1.5"), 0);
});

test("cleanStore odrzuca uszkodzone wpisy i pokoje, zachowuje dobre", () => {
  const raw = {
    rooms: {
      [ROOM]: {
        authHash: "h",
        last: 2,
        touched: NOW,
        entries: [{ seq: 1, data: "AA" }, { seq: "x", data: "AA" }, null, { seq: 2, data: 5 }],
      },
      "zle-id": { authHash: "h", last: 0, entries: [] },
      [`${"b".repeat(63)}1`]: { last: 0, entries: [] },
    },
  };
  const store = cleanStore(raw, NOW);
  assert.deepEqual(Object.keys(store.rooms), [ROOM]);
  assert.deepEqual(store.rooms[ROOM].entries, [{ seq: 1, data: "AA" }]);
});

test("cleanStore na zepsutym pliku daje pusty magazyn", () => {
  assert.deepEqual(cleanStore(null, NOW), emptyStore());
  assert.deepEqual(cleanStore("nie-obiekt", NOW), emptyStore());
  assert.deepEqual(cleanStore({ rooms: [] }, NOW), emptyStore());
});

test("expiredRooms: pokój nieruszany dłużej niż TTL", () => {
  const store = emptyStore();
  store.rooms[ROOM] = { authHash: "h", last: 0, touched: NOW - LIMITS.ROOM_TTL_MS - 1, entries: [] };
  store.rooms["b".repeat(64)] = { authHash: "h", last: 0, touched: NOW, entries: [] };
  assert.deepEqual(expiredRooms(store, NOW), [ROOM]);
});

const BID = "b".repeat(64);
test("identyfikator bloba: 64 cyfry hex", () => {
  assert.equal(validBlobId(BID), true);
  assert.equal(validBlobId("B".repeat(64)), false);
  assert.equal(validBlobId("../x"), false);
});

test("blob: limit rozmiaru pojedynczego i pokoju, istniejący się nie liczy drugi raz", () => {
  const room = { blobs: {} };
  assert.equal(blobFits(room, BID, 0).error, 413);
  assert.equal(blobFits(room, BID, LIMITS.MAX_BLOB_BYTES + 1).error, 413);
  assert.deepEqual(blobFits(room, BID, 100), { ok: true, existing: false });
  room.blobs[BID] = 100;
  assert.deepEqual(blobFits(room, BID, 100), { ok: true, existing: true });
  room.blobs = { [BID]: LIMITS.MAX_ROOM_BLOB_BYTES - 10 };
  assert.equal(blobFits(room, "c".repeat(64), 11).error, 507);
  assert.equal(blobFits(room, "c".repeat(64), 10).ok, true);
});

test("cleanStore zachowuje poprawne bloby, odrzuca śmieci", () => {
  const raw = { rooms: { [ROOM]: { authHash: "h", last: 0, touched: NOW, entries: [], blobs: { [BID]: 5, bad: 3, ["d".repeat(64)]: -1 } } } };
  const store = cleanStore(raw, NOW);
  assert.deepEqual(store.rooms[ROOM].blobs, { [BID]: 5 });
});
