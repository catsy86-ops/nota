// Przekaźnik synchronizacji E2E dla NOTKI. Trzyma zaszyfrowany log aktualizacji Yjs,
// żeby zmiany docierały, nawet gdy drugie urządzenie jest wyłączone. Nie zna kodu
// synchronizacji ani treści — widzi identyfikator pokoju, hash tokenu i bloby base64url.
// Dane w jednym pliku JSON w DATA_DIR (jak push-server; bez natywnych modułów).
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { WebSocketServer } from "ws";
import {
  LIMITS,
  appendEntry,
  applySnapshot,
  cleanStore,
  emptyStore,
  entriesSince,
  expiredRooms,
  openRoomForRead,
  openRoomForWrite,
  parseSince,
} from "./core.js";

const PORT = Number(process.env.PORT) || 4466;
const DATA_DIR = process.env.DATA_DIR || "./data";
const ORIGINS = (process.env.ALLOWED_ORIGINS || "*").split(",").map((s) => s.trim()).filter(Boolean);
const TRUST_PROXY = process.env.TRUST_PROXY === "1";
const RATE_PER_MIN = Number(process.env.RATE_PER_MIN) || 300;
const MAX_BODY = 1024 * 1024;
const MAX_SOCKETS_PER_ROOM = 20;
const SWEEP_MS = 60 * 60 * 1000;

mkdirSync(DATA_DIR, { recursive: true });
const STORE_FILE = join(DATA_DIR, "relay.json");

let store = emptyStore();
try {
  if (existsSync(STORE_FILE)) store = cleanStore(JSON.parse(readFileSync(STORE_FILE, "utf8")), Date.now());
} catch (e) {
  console.error("Nie udało się wczytać", STORE_FILE, e.message);
}

// Zapis partiami: aktualizacje przychodzą co sekundę z każdego aktywnego pokoju,
// więc pełny zapis po każdej nie ma sensu. Zapis przez plik tymczasowy.
let saveTimer = null;
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const tmp = `${STORE_FILE}.tmp`;
    writeFileSync(tmp, JSON.stringify(store));
    renameSync(tmp, STORE_FILE);
  }, 500);
}

// Limit zapytań na IP: okno jednej minuty.
const hits = new Map();
function rateLimited(ip, now) {
  const slot = hits.get(ip);
  if (!slot || now - slot.start >= 60_000) {
    hits.set(ip, { start: now, count: 1 });
    return false;
  }
  slot.count += 1;
  return slot.count > RATE_PER_MIN;
}

function clientIp(req) {
  if (TRUST_PROXY && req.headers["x-forwarded-for"]) return String(req.headers["x-forwarded-for"]).split(",")[0].trim();
  return req.socket.remoteAddress || "?";
}

function cors(req, res) {
  const origin = req.headers.origin;
  if (ORIGINS.includes("*")) res.setHeader("Access-Control-Allow-Origin", "*");
  else if (origin && ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error("Za duże"), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(Object.assign(new Error("Zły JSON"), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function tokenOf(req) {
  const h = req.headers.authorization || "";
  return h.startsWith("Bearer ") ? h.slice(7) : undefined;
}

// ── WebSocket: powiadomienie „jest nowy numer”; treść zawsze idzie przez GET ──────

const sockets = new Map(); // roomId → Set<WebSocket>
const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });

function notify(roomId, last) {
  const set = sockets.get(roomId);
  if (!set) return;
  const msg = JSON.stringify({ type: "updated", last });
  for (const ws of set) if (ws.readyState === ws.OPEN) ws.send(msg);
}

wss.on("connection", (ws) => {
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
    ws.send(JSON.stringify({ type: "ready", last: check.room.last }));
    ws.on("close", () => {
      set.delete(ws);
      if (!set.size) sockets.delete(roomId);
    });
  });
  ws.on("close", () => clearTimeout(timeout));
});

// ── trasy HTTP ───────────────────────────────────────────────────────────────

async function handle(req, res) {
  cors(req, res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, "http://relay");
  if (req.method === "GET" && url.pathname === "/health") {
    return send(res, 200, { ok: true, rooms: Object.keys(store.rooms).length });
  }

  const m = url.pathname.match(/^\/rooms\/([^/]+)\/(updates|snapshot)$/);
  if (!m) return send(res, 404, { error: "Nie ma takiej trasy" });
  const [, roomId, action] = m;

  if (req.method === "GET" && action === "updates") {
    const r = openRoomForRead(store, roomId, tokenOf(req));
    if (r.error) return send(res, r.error, { error: r.message });
    return send(res, 200, entriesSince(r.room, parseSince(url.searchParams.get("since"))));
  }

  if (req.method === "POST" && action === "updates") {
    const body = await readJson(req);
    const r = openRoomForWrite(store, roomId, tokenOf(req), Date.now());
    if (r.error) return send(res, r.error, { error: r.message });
    const a = appendEntry(r.room, body.data, Date.now());
    if (a.error) return send(res, a.error, { error: a.message });
    scheduleSave();
    notify(roomId, r.room.last);
    return send(res, 200, { seq: a.seq, last: r.room.last });
  }

  if (req.method === "PUT" && action === "snapshot") {
    const body = await readJson(req);
    const r = openRoomForWrite(store, roomId, tokenOf(req), Date.now());
    if (r.error) return send(res, r.error, { error: r.message });
    const s = applySnapshot(r.room, body.upto, body.data, Date.now());
    if (s.error) return send(res, s.error, { error: s.message });
    scheduleSave();
    notify(roomId, r.room.last);
    return send(res, 200, { seq: s.seq, last: r.room.last });
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
  if (new URL(req.url, "http://relay").pathname !== "/ws") return socket.destroy();
  if (rateLimited(clientIp(req), Date.now())) return socket.destroy();
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
});

setInterval(() => {
  const gone = expiredRooms(store, Date.now());
  for (const id of gone) delete store.rooms[id];
  if (gone.length) scheduleSave();
}, SWEEP_MS).unref();

server.listen(PORT, () => {
  console.log(`Przekaźnik na porcie ${PORT}; dane w ${DATA_DIR}; limit ${RATE_PER_MIN}/min na IP; wpis ≤ ${LIMITS.MAX_ENTRY_CHARS} zn.`);
});
