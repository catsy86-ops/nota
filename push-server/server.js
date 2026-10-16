// Serwer powiadomień Web Push dla NOTKI. Aplikacja przysyła listę terminów na
// najbliższe dni (`PUT /schedule`), serwer o czasie wysyła powiadomienie — także
// gdy aplikacja jest zamknięta. Dane w jednym pliku JSON w DATA_DIR.
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import webpush from "web-push";
import { cleanItems, cleanStore, cleanSubscription, dueItems, emptyStore, LIMITS, payloadOf, removeItems, subKey } from "./core.js";

const PORT = Number(process.env.PORT) || 4455;
const DATA_DIR = process.env.DATA_DIR || "./data";
const ORIGINS = (process.env.ALLOWED_ORIGINS || "*").split(",").map((s) => s.trim()).filter(Boolean);
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
const TICK_MS = 20_000;
const MAX_BODY = 64 * 1024;

mkdirSync(DATA_DIR, { recursive: true });
const STORE_FILE = join(DATA_DIR, "store.json");
const VAPID_FILE = join(DATA_DIR, "vapid.json");

function loadVapid() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  }
  if (existsSync(VAPID_FILE)) return JSON.parse(readFileSync(VAPID_FILE, "utf8"));
  // Pierwszy start: klucze zostają w pliku — ich zmiana unieważnia subskrypcje na telefonach.
  const keys = webpush.generateVAPIDKeys();
  writeFileSync(VAPID_FILE, JSON.stringify(keys, null, 2));
  console.log("Wygenerowano klucze VAPID w", VAPID_FILE);
  return keys;
}

const vapid = loadVapid();
webpush.setVapidDetails(SUBJECT, vapid.publicKey, vapid.privateKey);

let store = emptyStore();
try {
  if (existsSync(STORE_FILE)) store = cleanStore(JSON.parse(readFileSync(STORE_FILE, "utf8")), Date.now());
} catch (e) {
  console.error("Nie udało się wczytać", STORE_FILE, e.message);
}

function save() {
  // Zapis przez plik tymczasowy — przerwany zapis nie zostawia uciętego JSON-a.
  const tmp = `${STORE_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(store));
  renameSync(tmp, STORE_FILE);
}

function cors(req, res) {
  const origin = req.headers.origin;
  if (ORIGINS.includes("*")) res.setHeader("Access-Control-Allow-Origin", "*");
  else if (origin && ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error("too-large")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); } catch { reject(new Error("bad-json")); }
    });
    req.on("error", reject);
  });
}

/** Wysyłka z obsługą wygasłej subskrypcji (404/410 = telefon ją odwołał). */
async function push(id, subscription, payload) {
  try {
    await webpush.sendNotification(subscription, payload, { TTL: 3600, urgency: "high" });
    return true;
  } catch (e) {
    if (e.statusCode === 404 || e.statusCode === 410) {
      delete store.subs[id];
      console.log("Subskrypcja wygasła:", id);
    } else {
      console.error("Błąd wysyłki", id, e.statusCode || "", e.message);
    }
    return false;
  }
}

async function tick() {
  const now = Date.now();
  const { send: due, drop } = dueItems(store, now);
  if (due.length === 0 && drop.length === 0) return;
  for (const { id, item } of drop) removeItems(store, id, [item.key]);
  for (const { id, item } of due) {
    const sub = store.subs[id];
    if (!sub) continue;
    // Nieudana wysyłka (poza wygasłą subskrypcją) nie jest ponawiana — jak spóźniony termin.
    removeItems(store, id, [item.key]);
    await push(id, sub.subscription, payloadOf(item));
  }
  save();
}

const server = createServer(async (req, res) => {
  cors(req, res);
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  const path = new URL(req.url || "/", "http://x").pathname;
  try {
    if (req.method === "GET" && path === "/health") return send(res, 200, { ok: true });
    if (req.method === "GET" && path === "/vapid") return send(res, 200, { publicKey: vapid.publicKey });

    if (req.method === "PUT" && path === "/schedule") {
      const body = await readJson(req);
      const subscription = cleanSubscription(body.subscription);
      if (!subscription) return send(res, 400, { error: "subscription" });
      const id = subKey(subscription.endpoint);
      if (!store.subs[id] && Object.keys(store.subs).length >= LIMITS.subs) return send(res, 503, { error: "full" });
      const items = cleanItems(body.items, Date.now());
      store.subs[id] = { subscription, items, updated: Date.now() };
      save();
      return send(res, 200, { ok: true, items: items.length });
    }

    if (req.method === "POST" && path === "/unsubscribe") {
      const body = await readJson(req);
      if (typeof body.endpoint === "string") {
        delete store.subs[subKey(body.endpoint)];
        save();
      }
      return send(res, 200, { ok: true });
    }

    if (req.method === "POST" && path === "/test") {
      const body = await readJson(req);
      const subscription = cleanSubscription(body.subscription);
      if (!subscription) return send(res, 400, { error: "subscription" });
      const ok = await push(subKey(subscription.endpoint), subscription, payloadOf({
        key: `test:${Date.now()}`, title: "Próbne powiadomienie", body: "Serwer powiadomień działa — przypomnienia przyjdą też przy zamkniętej aplikacji.", url: "/",
      }));
      return send(res, ok ? 200 : 502, { ok });
    }

    send(res, 404, { error: "not-found" });
  } catch (e) {
    send(res, e.message === "too-large" ? 413 : 400, { error: e.message });
  }
});

server.listen(PORT, () => console.log(`Serwer powiadomień NOTKI na porcie ${PORT}`));
setInterval(() => { tick().catch((e) => console.error("tick", e)); }, TICK_MS);
