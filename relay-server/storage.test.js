// Magazyn plikowy przekaźnika (F2): awarie, migracja, migawka, pamięć podręczna, limity. Katalog tymczasowy na test.
// Test obciążenia w pełnym rozmiarze (200 pokoi × 2 000 wpisów): `LOAD=1 node --test storage.test.js`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LIMITS, hashToken, openRoomForRead, openRoomForWrite } from "./core.js";
import { openStorage } from "./storage.js";

const TOKEN = "t".repeat(43);
const NOW = 1_700_000_000_000;
const id = (n) => n.toString(16).padStart(64, "0");
const data = (n, len = 8) => `${n}`.padEnd(len, "A");

function tmp(t) {
  const dir = mkdtempSync(join(tmpdir(), "notki-storage-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

async function withRoom(s, room = id(1)) {
  const r = openRoomForWrite(s.store, room, TOKEN, NOW);
  assert.ok(r.room, r.message);
  return r.room;
}

async function fill(s, room, n) {
  const r = await withRoom(s, room);
  for (let i = 1; i <= n; i++) assert.deepEqual(await s.append(room, r, data(i), NOW + i), { seq: i });
  return r;
}

const seqs = async (s, room, since = 0) => (await s.read(room, s.store.rooms[room], since)).entries.map((e) => e.seq);
const logOf = (dir, room) => join(dir, "rooms", room, "log.ndjson");

test("dopisanie trafia na dysk przed odpowiedzią; po ponownym otwarciu wszystko jest", async (t) => {
  const dir = tmp(t);
  const s = await openStorage({ dir });
  await fill(s, id(1), 5);
  // Bez zapisu liczników (symulacja zabicia procesu): dziennik jest źródłem prawdy.
  const again = await openStorage({ dir });
  const room = again.store.rooms[id(1)];
  assert.equal(room.last, 5);
  assert.equal(room.count, 5);
  assert.equal(room.bytes, 5 * 8);
  assert.deepEqual(await seqs(again, id(1)), [1, 2, 3, 4, 5]);
  assert.ok(openRoomForRead(again.store, id(1), TOKEN).room, "token działa po restarcie");
  assert.equal(openRoomForRead(again.store, id(1), "x".repeat(43)).error, 403);
});

test("awaria: urwana ostatnia linia jest odrzucana, numeracja ciągnie się dalej", async (t) => {
  const dir = tmp(t);
  const s = await openStorage({ dir });
  await fill(s, id(1), 3);
  await s.flushMeta();
  appendFileSync(logOf(dir, id(1)), '{"seq":4,"at":1,"da');
  const again = await openStorage({ dir });
  assert.deepEqual(await seqs(again, id(1)), [1, 2, 3]);
  assert.equal(again.store.rooms[id(1)].last, 3);
  assert.ok(readFileSync(logOf(dir, id(1)), "utf8").endsWith("\n"), "dziennik oczyszczony");
  assert.deepEqual(await again.append(id(1), again.store.rooms[id(1)], data(4), NOW), { seq: 4 });
  const third = await openStorage({ dir });
  assert.deepEqual(await seqs(third, id(1)), [1, 2, 3, 4]);
});

test("awaria: pełny JSON bez znaku nowej linii (zapis urwany tuż przed nim) też jest odrzucany", async (t) => {
  const dir = tmp(t);
  const s = await openStorage({ dir });
  await fill(s, id(1), 3);
  await s.flushMeta();
  // Niepotwierdzony wpis: bez "\n" następne dopisanie skleiłoby się z nim w jedną zepsutą linię.
  appendFileSync(logOf(dir, id(1)), '{"seq":4,"at":1,"data":"AAAA"}');
  const again = await openStorage({ dir });
  assert.deepEqual(await seqs(again, id(1)), [1, 2, 3]);
  assert.deepEqual(await again.append(id(1), again.store.rooms[id(1)], data(4), NOW), { seq: 4 });
  assert.deepEqual(await again.append(id(1), again.store.rooms[id(1)], data(5), NOW), { seq: 5 });
  const third = await openStorage({ dir });
  assert.deepEqual(await seqs(third, id(1)), [1, 2, 3, 4, 5]);
});

test("awaria: brak meta.json — liczniki z dziennika, bloby z katalogu", async (t) => {
  const dir = tmp(t);
  const s = await openStorage({ dir });
  const room = await fill(s, id(1), 4);
  await s.putBlob(id(1), room, "b".repeat(64), Buffer.from("zaszyfrowane"));
  await s.flushMeta();
  unlinkSync(join(dir, "rooms", id(1), "meta.json"));
  const again = await openStorage({ dir });
  const r = again.store.rooms[id(1)];
  assert.equal(r.last, 4);
  assert.equal(r.count, 4);
  assert.deepEqual(r.blobs, { ["b".repeat(64)]: 12 });
  assert.equal(r.touched, NOW + 4, "czas ostatniego wpisu");
});

test("awaria: nieaktualne liczniki (dopisano po ich zapisie) są odtwarzane", async (t) => {
  const dir = tmp(t);
  const s = await openStorage({ dir });
  const room = await fill(s, id(1), 2);
  await s.flushMeta();
  await s.append(id(1), room, data(3), NOW + 3); // liczniki na dysku nadal mówią 2
  const again = await openStorage({ dir });
  assert.equal(again.store.rooms[id(1)].last, 3);
  assert.equal(again.store.rooms[id(1)].count, 3);
});

test("awaria: plik tymczasowy po przerwanej migawce jest usuwany, dziennik nietknięty", async (t) => {
  const dir = tmp(t);
  const s = await openStorage({ dir });
  await fill(s, id(1), 3);
  await s.flushMeta();
  writeFileSync(`${logOf(dir, id(1))}.tmp`, '{"seq":3,"at":1,"data":"SNAP","snapshot":true}\n');
  const again = await openStorage({ dir });
  assert.equal(existsSync(`${logOf(dir, id(1))}.tmp`), false);
  assert.deepEqual(await seqs(again, id(1)), [1, 2, 3]);
});

test("migawka zastępuje wpisy do upto; po ponownym otwarciu też", async (t) => {
  const dir = tmp(t);
  const s = await openStorage({ dir });
  const room = await fill(s, id(1), 5);
  assert.deepEqual(await s.snapshot(id(1), room, 3, "SNAP", NOW + 10), { seq: 3 });
  assert.equal(room.count, 3);
  assert.equal(room.snapshot, true);
  assert.equal(room.logSize, statSync(logOf(dir, id(1))).size);
  const read = await s.read(id(1), room, 0);
  assert.deepEqual(read.entries.map((e) => [e.seq, e.data, e.snapshot ?? false]), [[3, "SNAP", true], [4, data(4), false], [5, data(5), false]]);
  assert.deepEqual(await s.append(id(1), room, data(6), NOW), { seq: 6 });
  const again = await openStorage({ dir });
  assert.deepEqual(await seqs(again, id(1)), [3, 4, 5, 6]);
  assert.equal(again.store.rooms[id(1)].snapshot, true);
  assert.equal((await s.snapshot(id(1), room, 99, "X", NOW)).error, 400);
});

test("migracja z relay.json: pokoje, wpisy i bloby przechodzą, stary plik zostaje jako .bak", async (t) => {
  const dir = tmp(t);
  const legacy = {
    rooms: {
      [id(7)]: {
        authHash: hashToken(TOKEN), epoch: "e".repeat(32), last: 3, touched: NOW,
        entries: [{ seq: 2, data: "SNAP", at: NOW, snapshot: true }, { seq: 3, data: "AAAA", at: NOW }],
        blobs: {},
      },
    },
  };
  writeFileSync(join(dir, "relay.json"), JSON.stringify(legacy));
  const s = await openStorage({ dir });
  assert.equal(existsSync(join(dir, "relay.json")), false);
  assert.equal(existsSync(join(dir, "relay.json.bak")), true);
  const r = openRoomForRead(s.store, id(7), TOKEN);
  assert.ok(r.room);
  assert.equal(r.room.epoch, "e".repeat(32), "epoka zachowana");
  assert.deepEqual((await s.read(id(7), r.room, 0)).entries.map((e) => [e.seq, e.data]), [[2, "SNAP"], [3, "AAAA"]]);
  assert.deepEqual(await s.append(id(7), r.room, "BBBB", NOW), { seq: 4 });
  // Drugi start nie migruje ponownie (pliku nie ma), dane zostają.
  const again = await openStorage({ dir });
  assert.deepEqual(await seqs(again, id(7)), [2, 3, 4]);
});

test("odczyt stronicowany jak w core: PAGE wpisów i hasMore", async (t) => {
  const dir = tmp(t);
  const s = await openStorage({ dir });
  const room = await fill(s, id(1), LIMITS.PAGE + 3);
  const first = await s.read(id(1), room, 0);
  assert.equal(first.entries.length, LIMITS.PAGE);
  assert.equal(first.hasMore, true);
  assert.equal(first.last, LIMITS.PAGE + 3);
  const second = await s.read(id(1), room, LIMITS.PAGE);
  assert.deepEqual(second.entries.map((e) => e.seq), [LIMITS.PAGE + 1, LIMITS.PAGE + 2, LIMITS.PAGE + 3]);
  assert.equal(second.hasMore, false);
});

test("duży pokój czytany strumieniem, bez wkładania do pamięci podręcznej; wynik ten sam", async (t) => {
  const dir = tmp(t);
  const s = await openStorage({ dir, cacheBytes: 4000 });
  const room = await fill(s, id(1), LIMITS.PAGE + 2); // ok. 20 KB dziennika > ćwierć limitu
  const fresh = await openStorage({ dir, cacheBytes: 4000 });
  const r = fresh.store.rooms[id(1)];
  const page = await fresh.read(id(1), r, 1);
  assert.equal(page.entries.length, LIMITS.PAGE);
  assert.equal(page.entries[0].seq, 2);
  assert.equal(page.hasMore, true);
  assert.equal(fresh.cachedBytes, 0);
  assert.deepEqual((await fresh.read(id(1), r, LIMITS.PAGE + 1)).entries.map((e) => e.seq), [LIMITS.PAGE + 2]);
  assert.ok(room);
});

test("pamięć podręczna nie przekracza limitu przy wielu pokojach", async (t) => {
  const dir = tmp(t);
  const limit = 3000;
  const s = await openStorage({ dir, cacheBytes: limit });
  for (let k = 1; k <= 20; k++) {
    const room = await fill(s, id(k), 5);
    await s.read(id(k), room, 0);
    assert.ok(s.cachedBytes <= limit, `${s.cachedBytes} > ${limit}`);
  }
  // Pokój wyrzucony z pamięci podręcznej czyta się dalej poprawnie.
  assert.deepEqual(await seqs(s, id(1)), [1, 2, 3, 4, 5]);
});

test("limit łączny: dopisanie i blob ponad limit dostają 507, nic nie trafia na dysk", async (t) => {
  const dir = tmp(t);
  const s = await openStorage({ dir, maxTotalBytes: 200 });
  const room = await withRoom(s);
  let last;
  for (let i = 1; i <= 10; i++) { last = await s.append(id(1), room, data(i, 20), NOW); if (last.error) break; }
  assert.equal(last.error, 507);
  const size = statSync(logOf(dir, id(1))).size;
  assert.ok(size <= 200);
  assert.equal(s.totalBytes, size);
  assert.equal((await s.putBlob(id(1), room, "c".repeat(64), Buffer.alloc(500, 1))).error, 507);
});

test("mało wolnego miejsca na dysku: 507 przed zapisem, sprawdzane najwyżej co kilka sekund", async (t) => {
  const dir = tmp(t);
  let free = 10_000;
  let checks = 0;
  let clock = NOW;
  const s = await openStorage({ dir, minFreeBytes: 9_000, freeBytes: async () => { checks++; return free; }, now: () => clock });
  const room = await withRoom(s);
  assert.deepEqual(await s.append(id(1), room, data(1, 100), NOW), { seq: 1 });
  assert.deepEqual(await s.append(id(1), room, data(2, 100), NOW), { seq: 2 });
  assert.equal(checks, 1, "drugie dopisanie bez ponownego odczytu");
  // Odliczone lokalnie: kolejne dopisania zjadają zapas, aż zabraknie.
  let r;
  for (let i = 3; i < 30; i++) { r = await s.append(id(1), room, data(i, 100), NOW); if (r.error) break; }
  assert.equal(r.error, 507);
  assert.equal((await s.putBlob(id(1), room, "e".repeat(64), Buffer.alloc(2000, 1))).error, 507);
  // Po zwolnieniu miejsca i upływie czasu — zapis znowu przechodzi.
  free = 1_000_000;
  clock += 10_000;
  assert.ok((await s.append(id(1), room, data(99, 100), NOW)).seq);
});

test("równoległe dopisania do jednego pokoju: kolejne numery w kolejności zapisu", async (t) => {
  const dir = tmp(t);
  const s = await openStorage({ dir });
  const room = await withRoom(s);
  const results = await Promise.all(Array.from({ length: 50 }, (_, i) => s.append(id(1), room, data(i), NOW)));
  assert.deepEqual(results.map((r) => r.seq), Array.from({ length: 50 }, (_, i) => i + 1));
  const lines = readFileSync(logOf(dir, id(1)), "utf8").trim().split("\n").map((l) => JSON.parse(l).seq);
  assert.deepEqual(lines, results.map((r) => r.seq));
});

test("usunięcie pokoju zdejmuje katalogi i zwalnia limit", async (t) => {
  const dir = tmp(t);
  const s = await openStorage({ dir });
  const room = await fill(s, id(1), 2);
  await s.putBlob(id(1), room, "d".repeat(64), Buffer.from("xyz"));
  assert.ok(s.totalBytes > 0);
  assert.equal(await s.deleteRoom(id(1)), true);
  assert.equal(s.totalBytes, 0);
  assert.equal(existsSync(join(dir, "rooms", id(1))), false);
  assert.equal(existsSync(join(dir, "blobs", id(1))), false);
  assert.equal(s.store.rooms[id(1)], undefined);
  const again = await openStorage({ dir });
  assert.equal(again.store.rooms[id(1)], undefined);
});

test("wygasanie: młody pokój po dobie, używany i z migawką — dopiero po TTL", async (t) => {
  const dir = tmp(t);
  const s = await openStorage({ dir });
  await fill(s, id(1), 1); // młody
  await fill(s, id(2), 3); // używany
  const snap = await fill(s, id(3), 1);
  await s.snapshot(id(3), snap, 1, "SNAP", NOW + 1); // z migawką
  const day = NOW + LIMITS.YOUNG_TTL_MS + 10;
  assert.deepEqual(await s.expire(day), [id(1)]);
  assert.equal(existsSync(join(dir, "rooms", id(1))), false);
  assert.deepEqual((await s.expire(NOW + LIMITS.ROOM_TTL_MS + 10)).sort(), [id(2), id(3)]);
});

test("przestarzały obiekt pokoju po usunięciu: dopisanie i blob dostają 404, nowy pokój o tym id nietknięty (M1)", async (t) => {
  const dir = tmp(t);
  const s = await openStorage({ dir });
  const old = await fill(s, id(1), 2);
  assert.equal(await s.deleteRoom(id(1), old), true);
  const fresh = await withRoom(s, id(1)); // grupa zakłada pokój od nowa
  assert.deepEqual(await s.append(id(1), fresh, data(1), NOW), { seq: 1 });
  // Spóźnione operacje na starym obiekcie (np. wysyłka bloba trwająca w trakcie DELETE).
  assert.equal((await s.append(id(1), old, data(9), NOW)).error, 404);
  assert.equal((await s.putBlob(id(1), old, "f".repeat(64), Buffer.from("x"))).error, 404);
  assert.equal((await s.snapshot(id(1), old, 2, "SNAP", NOW)).error, 404);
  assert.equal(await s.deleteRoom(id(1), old), false, "stary obiekt nie usuwa nowego pokoju");
  assert.deepEqual(await seqs(s, id(1)), [1]);
  assert.equal(existsSync(join(dir, "blobs", id(1))), false);
  const again = await openStorage({ dir });
  assert.equal(again.store.rooms[id(1)].epoch, fresh.epoch, "tożsamość nowego pokoju nie nadpisana");
  assert.deepEqual(await seqs(again, id(1)), [1]);
});

test("równoległe bloby nie przekroczą limitu pokoju (sprawdzenie w kolejce, M2)", async (t) => {
  const dir = tmp(t);
  const s = await openStorage({ dir });
  const room = await withRoom(s);
  const saved = LIMITS.MAX_ROOM_BLOB_BYTES;
  LIMITS.MAX_ROOM_BLOB_BYTES = 3000;
  try {
    const results = await Promise.all(Array.from({ length: 5 }, (_, i) => s.putBlob(id(1), room, `${i}`.repeat(64), Buffer.alloc(1000, i))));
    assert.equal(results.filter((r) => r.ok).length, 3);
    assert.equal(results.filter((r) => r.error === 507).length, 2);
    assert.equal(Object.values(room.blobs).reduce((n, b) => n + b, 0), 3000);
  } finally {
    LIMITS.MAX_ROOM_BLOB_BYTES = saved;
  }
});

test("resztki przy starcie: katalog pokoju bez tożsamości i bloby bez pokoju znikają; nowy pokój nie dziedziczy starego dziennika (M3)", async (t) => {
  const dir = tmp(t);
  const s = await openStorage({ dir });
  await fill(s, id(1), 3);
  // Przerwane usuwanie: dziennik został, tożsamość nie; do tego osierocone bloby innego pokoju.
  unlinkSync(join(dir, "rooms", id(1), "room.json"));
  mkdirSync(join(dir, "blobs", id(2)), { recursive: true });
  writeFileSync(join(dir, "blobs", id(2), "a".repeat(64)), "x");
  const again = await openStorage({ dir });
  assert.equal(again.store.rooms[id(1)], undefined);
  assert.equal(existsSync(join(dir, "rooms", id(1))), false);
  assert.equal(existsSync(join(dir, "blobs", id(2))), false);
  const room = await withRoom(again, id(1));
  assert.deepEqual(await again.append(id(1), room, data(1), NOW), { seq: 1 });
  const third = await openStorage({ dir });
  assert.deepEqual(await seqs(third, id(1)), [1]);
});

test("uszkodzony relay.json nie znika i nie nadpisuje poprzedniej kopii (L2)", async (t) => {
  const dir = tmp(t);
  writeFileSync(join(dir, "relay.json.bak"), "dobra stara kopia");
  writeFileSync(join(dir, "relay.json"), "{ uszkodzony");
  const logs = [];
  await openStorage({ dir, log: (...a) => logs.push(a.join(" ")) });
  assert.equal(readFileSync(join(dir, "relay.json.bak"), "utf8"), "dobra stara kopia");
  assert.ok(readdirSync(dir).some((f) => f.startsWith("relay.json.corrupt-")));
  assert.ok(logs.every((l) => !l.includes(dir)), "log bez pełnych ścieżek");
});

test("limit łączny rezerwowany przed zapisem: równoległe dopisania do wielu pokoi go nie przekroczą (L3)", async (t) => {
  const dir = tmp(t);
  const s = await openStorage({ dir, maxTotalBytes: 300 });
  const rooms = await Promise.all(Array.from({ length: 10 }, (_, k) => withRoom(s, id(k + 1))));
  const results = await Promise.all(rooms.map((r, k) => s.append(id(k + 1), r, data(k, 40), NOW)));
  assert.ok(results.some((r) => r.error === 507));
  assert.ok(s.totalBytes <= 300, `${s.totalBytes}`);
});

test("pokój bez zapisu (np. odrzucony wpis) nie zostawia katalogu", async (t) => {
  const dir = tmp(t);
  const s = await openStorage({ dir });
  const room = await withRoom(s);
  assert.equal((await s.append(id(1), room, "zły wpis!", NOW)).error, 413);
  assert.equal(existsSync(join(dir, "rooms", id(1))), false);
  assert.deepEqual((await s.read(id(1), room, 0)).entries, []);
});

test("obciążenie: dopisanie w czasie stałym, pamięć pod limitem", { timeout: 600_000 }, async (t) => {
  const full = !!process.env.LOAD;
  const rooms = full ? 200 : 20;
  const per = full ? 2000 : 200;
  const dir = tmp(t);
  const cacheBytes = 2 * 1024 * 1024;
  const s = await openStorage({ dir, cacheBytes });
  const timeBatch = async (k0) => {
    const t0 = performance.now();
    for (let k = 0; k < rooms; k++) await s.append(id(k + 1), s.store.rooms[id(k + 1)], data(k0, 200), NOW);
    return (performance.now() - t0) / rooms;
  };
  for (let k = 0; k < rooms; k++) await withRoom(s, id(k + 1));
  const early = [];
  const late = [];
  for (let i = 0; i < per; i++) {
    const ms = await timeBatch(i);
    if (i >= 5 && i < 25) early.push(ms);
    if (i >= per - 20) late.push(ms);
    if (i % 50 === 0) await s.read(id((i % rooms) + 1), s.store.rooms[id((i % rooms) + 1)], 0);
    assert.ok(s.cachedBytes <= cacheBytes);
  }
  const median = (a) => a.sort((x, y) => x - y)[Math.floor(a.length / 2)];
  const [e, l] = [median(early), median(late)];
  // Z `--expose-gc` sterta bez śmieci: same liczniki pokoi i pamięć podręczna, nie suma wpisów.
  globalThis.gc?.();
  const heap = process.memoryUsage().heapUsed / 2 ** 20;
  t.diagnostic(`dopisanie: początek ${e.toFixed(3)} ms, koniec ${l.toFixed(3)} ms; ${rooms}×${per}; heap ${heap.toFixed(0)} MB${globalThis.gc ? " po GC" : ""}`);
  if (globalThis.gc) assert.ok(heap < 64, `sterta ${heap} MB`);
  // Czas stały: koniec najwyżej kilka razy wolniejszy niż początek (dysk bywa zmienny), nie proporcjonalny do liczby wpisów.
  assert.ok(l < Math.max(e * 5, 5), `początek ${e} ms, koniec ${l} ms`);
  assert.equal(s.store.rooms[id(1)].count, per);
});

test("NEW_EPOCHS: po odtworzeniu z kopii każdy pokój ma nową epokę, wpisy i token zostają (S2.3, Z-15.8)", async (t) => {
  const dir = tmp(t);
  const s = await openStorage({ dir });
  await fill(s, id(1), 3);
  await fill(s, id(2), 1);
  const before = { a: s.store.rooms[id(1)].epoch, b: s.store.rooms[id(2)].epoch };
  const logs = [];
  const renewed = await openStorage({ dir, newEpochs: true, log: (m) => logs.push(m) });
  assert.notEqual(renewed.store.rooms[id(1)].epoch, before.a);
  assert.notEqual(renewed.store.rooms[id(2)].epoch, before.b);
  assert.deepEqual(await seqs(renewed, id(1)), [1, 2, 3]);
  assert.ok(openRoomForRead(renewed.store, id(1), TOKEN).room, "token działa po nowej epoce");
  assert.ok(logs.some((m) => /Nowe epoki dla 2 pokoi/.test(m)));
  // Bez przełącznika epoka z odnowienia jest trwała.
  const later = await openStorage({ dir });
  assert.equal(later.store.rooms[id(1)].epoch, renewed.store.rooms[id(1)].epoch);
});

test("numer wpisu nie maleje w epoce po kompaktowaniu i restarcie (S2.3 §2.5)", async (t) => {
  const dir = tmp(t);
  const s = await openStorage({ dir });
  const room = await fill(s, id(1), 6);
  const epoch = room.epoch;
  await s.snapshot(id(1), room, 6, "SNAP", NOW + 10);
  assert.equal(room.last, 6);
  const again = await openStorage({ dir });
  const r2 = again.store.rooms[id(1)];
  assert.equal(r2.epoch, epoch);
  assert.ok(r2.last >= 6, `last ${r2.last}`);
  assert.deepEqual(await again.append(id(1), r2, data(7), NOW + 20), { seq: 7 });
});
