// Przekaźnik synchronizacji E2E dla NOTKI. Trzyma zaszyfrowany log aktualizacji Yjs,
// żeby zmiany docierały, nawet gdy drugie urządzenie jest wyłączone. Nie zna kodu
// synchronizacji ani treści — widzi identyfikator pokoju, hash tokenu i bloby base64url.
// Dane w DATA_DIR: katalog na pokój z dziennikiem dopisywanym (`storage.js`, F2); bez natywnych modułów.
import { createServer } from "node:http";
import { createReadStream, existsSync, mkdirSync } from "node:fs";
import { WebSocketServer } from "ws";
import {
  LIMITS,
  epochConflict,
  openRoomForRead,
  openRoomForWrite,
  parseSince,
  validBlobId,
  validRoomId,
  validToken,
} from "./core.js";
import { openStorage } from "./storage.js";
import { clientIpOf, limitKey, readConfig } from "./config.js";

// S4.3: błędna konfiguracja zatrzymuje start (zamiast przekaźnika otwartego dla każdej strony albo z podrabialnym adresem).
const CONFIG = readConfig(process.env);
if (CONFIG.errors.length) {
  for (const e of CONFIG.errors) console.error(`Konfiguracja: ${e}`);
  process.exit(1);
}
// S4.4: limity do warunków serwera (MAX_ROOMS, MAX_ROOM_BLOB_BYTES ze zmiennych środowiska).
Object.assign(LIMITS, CONFIG.limits);

const PORT = CONFIG.port;
const DATA_DIR = CONFIG.dataDir;
const ORIGINS = CONFIG.origins;
const RATE_PER_MIN = CONFIG.ratePerMin;
/** Ile NOWYCH pokoi może założyć jeden adres na dobę (S4 audytu: jedno urządzenie nie zapełni serwera). */
const ROOMS_PER_IP_PER_DAY = CONFIG.roomsPerIpPerDay;
const MAX_BODY = 1024 * 1024;
// Wpis i migawka mają własny, większy limit treści (dane + koperta JSON).
const MAX_ENTRY_BODY = LIMITS.MAX_ENTRY_CHARS + 4096;
const MAX_SOCKETS_PER_ROOM = 20;
/** Łącznie bajtów treści żądań czytanych naraz (wpis do 22 MB): powyżej — 503 zamiast braku pamięci. */
const BODY_BUDGET = 256 * 1024 * 1024;
/** Równoległych wysyłek treści z jednego adresu (IPv6: z jednej /64). */
const UPLOADS_PER_IP = 4;
/** Najwięcej śledzonych adresów w licznikach limitów — mapa nie rośnie bez końca przy wielu adresach. */
const MAX_LIMITER_KEYS = 100_000;
const SWEEP_MS = 60 * 60 * 1000;

mkdirSync(DATA_DIR, { recursive: true });
// Każde dopisanie trafia na dysk przed odpowiedzią — nie ma już okna utraty potwierdzonych wpisów (dawniej do 500 ms).
// Przed zapisem: limit łączny (MAX_TOTAL_BYTES) i wolne miejsce na dysku (MIN_FREE_BYTES) — 507 zamiast awarii.
const storage = await openStorage({
  dir: DATA_DIR, cacheBytes: CONFIG.cacheBytes, maxTotalBytes: CONFIG.maxTotalBytes, minFreeBytes: CONFIG.minFreeBytes,
  log: (...a) => console.error(...a),
  newEpochs: CONFIG.newEpochs,
});
const store = storage.store;

/** Wstawienie do mapy limitu z górną granicą: przy przepełnieniu wypadają najstarsze wpisy. */
function capped(map, key, value) {
  map.delete(key);
  map.set(key, value);
  if (map.size > MAX_LIMITER_KEYS) for (const k of map.keys()) { map.delete(k); if (map.size <= MAX_LIMITER_KEYS * 0.9) break; }
}

// Limit zapytań na adres (IPv6: /64): okno jednej minuty.
const hits = new Map();
function rateLimited(ip, now) {
  const key = limitKey(ip);
  const slot = hits.get(key);
  if (!slot || now - slot.start >= 60_000) {
    capped(hits, key, { start: now, count: 1 });
    return false;
  }
  slot.count += 1;
  return slot.count > RATE_PER_MIN;
}

// Zakładanie nowych pokoi: okno doby na adres.
const creations = new Map();
/**
 * `true`, gdy to żądanie założyłoby nowy pokój, a adres wyczerpał dobowy limit. Istniejący pokój (zapis z tokenem)
 * nie jest liczony; liczymy tylko żądania z poprawnym identyfikatorem i tokenem, czyli takie, które pokój założą.
 */
function creationLimited(req, roomId, now) {
  if (store.rooms[roomId] || !validRoomId(roomId) || !validToken(tokenOf(req))) return false;
  const key = limitKey(clientIp(req));
  const slot = creations.get(key);
  if (!slot || now - slot.start >= 86_400_000) { capped(creations, key, { start: now, count: 1 }); return false; }
  slot.count += 1;
  return slot.count > ROOMS_PER_IP_PER_DAY;
}

/** Usuwa wygasłe liczniki limitu (inaczej mapa rośnie z każdym nowym adresem). */
function sweepHits(now) {
  for (const [ip, slot] of hits) if (now - slot.start >= 60_000) hits.delete(ip);
  for (const [ip, slot] of creations) if (now - slot.start >= 86_400_000) creations.delete(ip);
}

let warnedForwarded = false;
function clientIp(req) {
  // X-Forwarded-For tylko od zaufanego pośrednika (TRUSTED_PROXY), i wtedy ostatni wpis — pierwszy dałoby się podrobić.
  const { ip, forwardedIgnored } = clientIpOf(CONFIG, req.socket.remoteAddress, req.headers["x-forwarded-for"]);
  if (forwardedIgnored && !warnedForwarded) {
    warnedForwarded = true;
    console.error("Uwaga: żądania mają X-Forwarded-For, a TRUST_PROXY=0 — za pośrednikiem limity na adres liczą adres pośrednika. Ustaw TRUST_PROXY=1 i TRUSTED_PROXY.");
  }
  return ip;
}

function cors(req, res) {
  const origin = req.headers.origin;
  if (ORIGINS.includes("*")) res.setHeader("Access-Control-Allow-Origin", "*");
  else if (origin && ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

const httpError = (status, message) => Object.assign(new Error(message), { status });

// Treść żądań w locie: łącznie i na adres. Czytamy dopiero po sprawdzeniu pokoju i tokenu (H3 przeglądu F2).
let inflight = 0;
const uploads = new Map();

/** Surowe bajty treści z limitem rozmiaru, budżetem łącznym i limitem równoległych wysyłek z jednego adresu. */
function readRaw(req, max) {
  const declared = Number(req.headers["content-length"]);
  if (Number.isFinite(declared) && declared > max) return Promise.reject(httpError(413, "Za duże"));
  const key = limitKey(clientIp(req));
  const running = uploads.get(key) ?? 0;
  if (running >= UPLOADS_PER_IP) return Promise.reject(httpError(429, "Za dużo równoległych wysyłek"));
  uploads.set(key, running + 1);
  let held = 0;
  let settled = false;
  // Rozliczenie dokładnie raz: koniec, błąd albo zerwane połączenie (wtedy bywa tylko `close`).
  const done = () => {
    if (settled) return false;
    settled = true;
    inflight -= held;
    held = 0;
    const n = (uploads.get(key) ?? 1) - 1;
    if (n > 0) uploads.set(key, n); else uploads.delete(key);
    return true;
  };
  return new Promise((resolve, reject) => {
    const chunks = [];
    const fail = (err) => { if (done()) reject(err); req.destroy(); };
    req.on("data", (c) => {
      if (settled) return;
      if (held + c.length > max) return fail(httpError(413, "Za duże"));
      if (inflight + c.length > BODY_BUDGET) return fail(httpError(503, "Przekaźnik zajęty, spróbuj za chwilę"));
      held += c.length;
      inflight += c.length;
      chunks.push(c);
    });
    req.on("end", () => { if (done()) resolve(Buffer.concat(chunks)); });
    req.on("error", (e) => { if (done()) reject(e); });
    req.on("close", () => { if (done()) reject(httpError(400, "Połączenie zerwane")); });
  });
}

async function readJson(req, max = MAX_BODY) {
  const bytes = await readRaw(req, max);
  try {
    return JSON.parse(bytes.toString("utf8") || "{}");
  } catch {
    throw httpError(400, "Zły JSON");
  }
}

function tokenOf(req) {
  const h = req.headers.authorization || "";
  return h.startsWith("Bearer ") ? h.slice(7) : undefined;
}

// ── WebSocket: powiadomienie „jest nowy numer”; treść zawsze idzie przez GET ──────

const sockets = new Map(); // roomId → Set<WebSocket>
const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });

function notify(roomId, room) {
  const set = sockets.get(roomId);
  if (!set) return;
  const msg = JSON.stringify({ type: "updated", last: room.last, epoch: room.epoch });
  for (const ws of set) if (ws.readyState === ws.OPEN) ws.send(msg);
}

// Zbyt długa albo uszkodzona ramka powoduje zdarzenie `error` na gnieździe; bez nasłuchu Node kończy proces
// (jeden anonimowy pakiet = awaria usługi).
wss.on("error", (e) => console.error("wss", e.message));

wss.on("connection", (ws) => {
  ws.on("error", () => ws.terminate());
  let roomId = null;
  // Klient ma 10 s na przedstawienie się; bez tego gniazda wiszą bez końca.
  const timeout = setTimeout(() => ws.close(4000, "brak subskrypcji"), 10_000);
  ws.on("message", (raw) => {
    if (roomId) return;
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return ws.close(4001, "zły JSON");
    }
    if (msg?.type !== "subscribe") return ws.close(4001, "oczekiwano subscribe");
    const check = openRoomForRead(store, msg.room, msg.token);
    if (check.error) return ws.close(4003, check.message);
    const set = sockets.get(msg.room) || new Set();
    if (set.size >= MAX_SOCKETS_PER_ROOM) return ws.close(4029, "za dużo połączeń");
    set.add(ws);
    sockets.set(msg.room, set);
    roomId = msg.room;
    clearTimeout(timeout);
    ws.send(JSON.stringify({ type: "ready", last: check.room.last, epoch: check.room.epoch }));
    ws.on("close", () => {
      set.delete(ws);
      if (!set.size) sockets.delete(roomId);
    });
  });
  ws.on("close", () => clearTimeout(timeout));
});

// ── trasy HTTP ───────────────────────────────────────────────────────────────

/**
 * Bloby (obrazy, załączniki): zaszyfrowane bajty pod identyfikatorem, który wylicza klient
 * (HMAC z hasha treści). Autoryzacja przed czytaniem treści, żeby nieuwierzytelniony nie
 * wpychał 24 MB do pamięci.
 */
async function handleBlob(req, res, roomId, blobId) {
  if (!validBlobId(blobId)) return send(res, 400, { error: "Zły identyfikator bloba" });
  const path = storage.blobPath(roomId, blobId);

  if (req.method === "PUT") {
    if (creationLimited(req, roomId, Date.now())) return send(res, 429, { error: "Za dużo nowych pokoi z tego adresu" });
    const r = openRoomForWrite(store, roomId, tokenOf(req), Date.now());
    if (r.error) return send(res, r.error, { error: r.message });
    const bytes = await readRaw(req, LIMITS.MAX_BLOB_BYTES);
    // W trakcie wysyłki (do 24 MB) pokój mógł zostać usunięty albo założony od nowa — bierzemy obecny obiekt.
    const now2 = openRoomForWrite(store, roomId, tokenOf(req), Date.now());
    if (now2.error) return send(res, now2.error, { error: now2.message });
    const put = await storage.putBlob(roomId, now2.room, blobId, bytes);
    if (put.error) return send(res, put.error, { error: put.message });
    return send(res, 200, put);
  }

  if (req.method === "GET" || req.method === "HEAD") {
    const r = openRoomForRead(store, roomId, tokenOf(req));
    if (r.error) return send(res, r.error, { error: r.message });
    const size = r.room.blobs[blobId];
    if (!size || !existsSync(path)) return send(res, 404, { error: "Nie ma takiego bloba" });
    res.writeHead(200, { "Content-Type": "application/octet-stream", "Content-Length": size, "Cache-Control": "no-store" });
    if (req.method === "HEAD") return res.end();
    const stream = createReadStream(path);
    // Blob usunięty między sprawdzeniem a otwarciem: zerwanie odpowiedzi zamiast wiszącego żądania.
    stream.on("error", () => res.destroy());
    stream.pipe(res);
    return;
  }

  return send(res, 405, { error: "Metoda niedozwolona" });
}

async function handle(req, res) {
  cors(req, res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, "http://relay");
  if (req.method === "GET" && url.pathname === "/health") {
    return send(res, 200, { ok: true }); // S4.6: bez liczby pokoi ani innych danych — adres jest jawny
  }

  const blob = url.pathname.match(/^\/rooms\/([^/]+)\/blobs\/([^/]+)$/);
  if (blob) return handleBlob(req, res, blob[1], blob[2]);

  // Usunięcie pokoju razem z blobami („Opuść grupę” → „usuń też z przekaźnika”). Wymaga tokenu pokoju (S13 audytu).
  const roomOnly = url.pathname.match(/^\/rooms\/([^/]+)$/);
  if (roomOnly && req.method === "DELETE") {
    const roomId = roomOnly[1];
    const r = openRoomForRead(store, roomId, tokenOf(req));
    if (r.error) return send(res, r.error, { error: r.message });
    await storage.deleteRoom(roomId, r.room);
    for (const ws of sockets.get(roomId) ?? []) ws.close(4004, "pokój usunięty");
    sockets.delete(roomId);
    return send(res, 200, { ok: true });
  }

  const m = url.pathname.match(/^\/rooms\/([^/]+)\/(updates|snapshot)$/);
  if (!m) return send(res, 404, { error: "Nie ma takiej trasy" });
  const [, roomId, action] = m;

  if (req.method === "GET" && action === "updates") {
    const r = openRoomForRead(store, roomId, tokenOf(req));
    if (r.error) return send(res, r.error, { error: r.message });
    return send(res, 200, await storage.read(roomId, r.room, parseSince(url.searchParams.get("since"))));
  }

  if (req.method === "POST" && action === "updates") {
    // Przed czytaniem treści (do 22 MB): identyfikator, token, a dla nowego pokoju — limit nowych pokoi (H3 przeglądu F2).
    if (store.rooms[roomId]) {
      const pre = openRoomForRead(store, roomId, tokenOf(req));
      if (pre.error) return send(res, pre.error, { error: pre.message });
    } else {
      if (!validRoomId(roomId)) return send(res, 400, { error: "Zły identyfikator pokoju" });
      if (!validToken(tokenOf(req))) return send(res, 401, { error: "Brak tokenu" });
      if (creationLimited(req, roomId, Date.now())) return send(res, 429, { error: "Za dużo nowych pokoi z tego adresu" });
    }
    const body = await readJson(req, MAX_ENTRY_BODY);
    // Przed założeniem pokoju: klient ze starą epoką nie może odtworzyć pokoju samą różnicą.
    const existing = store.rooms[roomId];
    if (existing ? openRoomForRead(store, roomId, tokenOf(req)).room : true) {
      const gone = epochConflict(existing, body.epoch);
      if (gone) return send(res, gone.error, { error: gone.message });
    }
    const r = openRoomForWrite(store, roomId, tokenOf(req), Date.now());
    if (r.error) return send(res, r.error, { error: r.message });
    const a = await storage.append(roomId, r.room, body.data, Date.now());
    if (a.error) return send(res, a.error, { error: a.message });
    notify(roomId, r.room);
    return send(res, 200, { seq: a.seq, last: r.room.last, epoch: r.room.epoch });
  }

  if (req.method === "PUT" && action === "snapshot") {
    // Migawka nigdy nie zakłada pokoju: w pustym pokoju nie ma numeru, który mogłaby zastąpić. Sprawdzenie przed treścią.
    const pre = openRoomForRead(store, roomId, tokenOf(req));
    if (pre.error) return send(res, pre.error, { error: pre.message });
    const body = await readJson(req, MAX_ENTRY_BODY);
    const r = openRoomForRead(store, roomId, tokenOf(req));
    if (r.error) return send(res, r.error, { error: r.message });
    // Migawka z innej epoki skasowałaby cudze wpisy stanem urządzenia, które ich nie pobrało.
    const gone = epochConflict(r.room, body.epoch);
    if (gone) return send(res, gone.error, { error: gone.message });
    const s = await storage.snapshot(roomId, r.room, body.upto, body.data, Date.now());
    if (s.error) return send(res, s.error, { error: s.message });
    notify(roomId, r.room);
    return send(res, 200, { seq: s.seq, last: r.room.last, epoch: r.room.epoch });
  }

  return send(res, 405, { error: "Metoda niedozwolona" });
}

const server = createServer(async (req, res) => {
  if (rateLimited(clientIp(req), Date.now())) return send(res, 429, { error: "Za dużo zapytań" });
  try {
    await handle(req, res);
  } catch (e) {
    if (res.headersSent) return res.end();
    const status = e.status || 500;
    if (status === 500) console.error(e);
    send(res, status, { error: status === 500 ? "Błąd serwera" : e.message });
  }
});

server.on("upgrade", (req, socket, head) => {
  socket.on("error", () => socket.destroy());
  // `new URL` rzuca dla niektórych ścieżek (np. `//`) — bez `try` jedno żądanie Upgrade zabijało proces.
  let pathname;
  try { pathname = new URL(req.url, "http://relay").pathname; } catch { return socket.destroy(); }
  if (pathname !== "/ws") return socket.destroy();
  if (rateLimited(clientIp(req), Date.now())) return socket.destroy();
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
});

setInterval(() => sweepHits(Date.now()), 60_000).unref();

setInterval(() => {
  storage.expire(Date.now()).then((gone) => {
    for (const id of gone) {
      for (const ws of sockets.get(id) ?? []) ws.close(4004, "pokój wygasł");
      sockets.delete(id);
    }
  }, (e) => console.error("Sprzątanie pokoi nieudane:", e.message));
}, SWEEP_MS).unref();

server.listen(PORT, () => {
  console.log(`Przekaźnik na porcie ${PORT}; dane w ${DATA_DIR}; limit ${RATE_PER_MIN}/min na IP; wpis ≤ ${LIMITS.MAX_ENTRY_CHARS} zn.`);
});

// Łagodne zamknięcie: zaległe liczniki pokoi na dysk (wpisy są tam od razu; liczniki odtwarza też sam dziennik).
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => {
    try { storage.flushSync(); } catch (e) { console.error("Zapis przy zamknięciu nieudany:", e.message); }
    process.exit(0);
  });
}
// Nieprzewidziany błąd w jednym żądaniu nie może zabić całej usługi.
process.on("uncaughtException", (e) => console.error("uncaughtException", e.message));
process.on("unhandledRejection", (e) => console.error("unhandledRejection", e?.message ?? e));
