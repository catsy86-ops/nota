// Serwer powiadomień Web Push dla NOTKI. Aplikacja przysyła listę terminów na
// najbliższe dni (`PUT /schedule`), serwer o czasie wysyła powiadomienie — także
// gdy aplikacja jest zamknięta. Dane w jednym pliku JSON w DATA_DIR.
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import webpush from "web-push";
import {
  bearerOf, cleanItems, cleanStore, cleanSubscription, clientIp, corsOrigin, createRateLimiter, dueItems, emptyStore, LIMITS,
  normalizeEndpoint, parseOrigins, payloadOf, removeItems, staleSubs, subKey, tokenOk,
} from "./core.js";

const PORT = Number(process.env.PORT) || 4455;
const DATA_DIR = process.env.DATA_DIR || "./data";
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
const TICK_MS = 20_000;
const MAX_BODY = 64 * 1024;

// ── Zabezpieczenia ────────────────────────────────────────────────────────────────────────────────────
// Bez nich każdy, kto zna adres serwera, mógłby zająć miejsca na subskrypcje, kasować cudze i wysyłać
// powiadomienia podpisane Twoim kluczem VAPID. Dlatego serwer nie startuje bez tokenu (`PUSH_TOKEN`).
const TOKEN = process.env.PUSH_TOKEN || "";
const ALLOW_NO_AUTH = process.env.ALLOW_NO_AUTH === "1";
const TRUST_PROXY = process.env.TRUST_PROXY === "1";
const ORIGINS = parseOrigins(process.env.ALLOWED_ORIGINS);
const envInt = (name, def) => { const n = Number(process.env[name]); return Number.isInteger(n) && n > 0 ? n : def; };

if (!TOKEN && !ALLOW_NO_AUTH) {
  console.error("Brak PUSH_TOKEN. Ustaw długi losowy token (min. 24 znaki), np. `openssl rand -hex 24`, i wpisz go też w aplikacji.\n" +
    "Tylko do prób lokalnych: ALLOW_NO_AUTH=1 (bez uwierzytelniania, nie wystawiaj tak serwera do internetu).");
  process.exit(1);
}
if (TOKEN && TOKEN.length < 24) {
  console.error("PUSH_TOKEN jest za krótki — potrzeba co najmniej 24 znaków.");
  process.exit(1);
}
if (!TOKEN) console.warn("UWAGA: ALLOW_NO_AUTH=1 — serwer przyjmuje żądania bez uwierzytelniania.");
if (ORIGINS.length === 0) console.warn("ALLOWED_ORIGINS puste: przeglądarka nie pozwoli stronie z innej domeny połączyć się z serwerem. Wpisz adres aplikacji.");
if (ORIGINS.includes("*")) console.warn("UWAGA: ALLOWED_ORIGINS=* — każda strona może wywoływać serwer z przeglądarki (token nadal jest wymagany).");

// Limity w oknie 1 minuty (adres klienta) i 1 godziny (jedna subskrypcja).
const perIp = createRateLimiter({ windowMs: 60_000, max: envInt("RATE_IP_PER_MIN", 120) });
const authFails = createRateLimiter({ windowMs: 15 * 60_000, max: envInt("RATE_AUTH_FAILS", 10) });
const perSubSchedule = createRateLimiter({ windowMs: 3_600_000, max: envInt("RATE_SCHEDULE_PER_HOUR", 240) });
const perSubTest = createRateLimiter({ windowMs: 3_600_000, max: envInt("RATE_TEST_PER_HOUR", 5) });

// Dane i klucz prywatny VAPID tylko dla użytkownika serwera (0700 / 0600).
mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
const STORE_FILE = join(DATA_DIR, "store.json");
const VAPID_FILE = join(DATA_DIR, "vapid.json");

function loadVapid() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  }
  if (existsSync(VAPID_FILE)) {
    const keys = JSON.parse(readFileSync(VAPID_FILE, "utf8"));
    if (typeof keys?.publicKey !== "string" || typeof keys?.privateKey !== "string") throw new Error(`${VAPID_FILE}: brak publicKey/privateKey`);
    return keys;
  }
  // Pierwszy start: klucze zostają w pliku — ich zmiana unieważnia subskrypcje na telefonach.
  const keys = webpush.generateVAPIDKeys();
  writeFileSync(VAPID_FILE, JSON.stringify(keys, null, 2), { mode: 0o600 });
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
  writeFileSync(tmp, JSON.stringify(store), { mode: 0o600 });
  renameSync(tmp, STORE_FILE);
}

function cors(req, res) {
  const allow = corsOrigin(req.headers.origin, ORIGINS);
  if (allow) {
    res.setHeader("Access-Control-Allow-Origin", allow);
    if (allow !== "*") res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "600");
}

function send(res, status, body, extra = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...extra });
  res.end(JSON.stringify(body));
}

const tooMany = (res, retryAfterSec) => send(res, 429, { error: "rate-limited" }, { "Retry-After": String(retryAfterSec) });

/** Połyka resztę zbyt dużego ciała (do `DRAIN_MAX`), żeby klient zdążył dostać 413; dalej — zrywa połączenie. */
const DRAIN_MAX = 1024 * 1024;
function drain(req, already = 0) {
  let n = already;
  req.on("data", (c) => { n += c.length; if (n > DRAIN_MAX) req.destroy(); });
  req.resume();
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    if (Number(req.headers["content-length"]) > MAX_BODY) { drain(req); reject(new Error("too-large")); return; }
    let size = 0;
    let over = false;
    const chunks = [];
    req.on("data", (c) => {
      if (over) return;
      size += c.length;
      if (size > MAX_BODY) { over = true; chunks.length = 0; drain(req, size); reject(new Error("too-large")); return; }
      chunks.push(c);
    });
    req.on("end", () => {
      if (over) return;
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); } catch { reject(new Error("bad-json")); }
    });
    req.on("error", reject);
  });
}

/** Wysyłka z obsługą wygasłej subskrypcji (404/410 = telefon ją odwołał). */
async function push(id, subscription, payload) {
  try {
    // Limit czasu: zawieszony serwis push nie może blokować pętli wysyłki ani gniazd.
    await webpush.sendNotification(subscription, payload, { TTL: 3600, urgency: "high", timeout: 10_000 });
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

let ticking = false;
async function tick() {
  if (ticking) return; // poprzedni obieg jeszcze trwa (wolna usługa push) — nie mnożymy wywołań
  ticking = true;
  try {
    const now = Date.now();
    let dirty = false;
    for (const id of staleSubs(store, now)) { delete store.subs[id]; dirty = true; console.log("Subskrypcja bez aktywności usunięta:", id); }
    const { send: due, drop } = dueItems(store, now);
    for (const { id, item } of drop) removeItems(store, id, [item.key]);
    for (const { id, item } of due) {
      const sub = store.subs[id];
      if (!sub) continue;
      // Nieudana wysyłka (poza wygasłą subskrypcją) nie jest ponawiana — jak spóźniony termin.
      removeItems(store, id, [item.key]);
      await push(id, sub.subscription, payloadOf(item));
    }
    if (dirty || due.length > 0 || drop.length > 0) save();
  } finally {
    ticking = false;
  }
}

/**
 * Zwraca `true`, gdy żądanie ma poprawny token; inaczej sam odpowiada (401, a po zbyt wielu błędnych próbach 429).
 * Token sprawdzamy PRZED limitem: limit dotyczy tylko błędnych prób, więc osoba za tym samym adresem (wspólne proxy,
 * sieć komórkowa) nie zablokuje właściciela serią złych tokenów. Brute force nie ma szans przy tokenie z 96+ bitami.
 */
function authorize(req, res, ip, now) {
  if (!TOKEN) return true;
  if (tokenOk(bearerOf(req.headers.authorization), TOKEN)) return true;
  const state = authFails.check(ip, now);
  if (!state.ok) { tooMany(res, state.retryAfterSec); return false; }
  authFails.record(ip, now);
  send(res, 401, { error: "unauthorized" }, { "WWW-Authenticate": "Bearer" });
  return false;
}

async function handle(req, res) {
  const now = Date.now();
  const ip = clientIp(req.socket.remoteAddress, req.headers["x-forwarded-for"], TRUST_PROXY);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store");
  cors(req, res);
  const limit = perIp.hit(ip, now);
  if (!limit.ok) return tooMany(res, limit.retryAfterSec);
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  // `new URL` rzuca dla niektórych ścieżek (np. `//[`); bez tego jedno anonimowe żądanie ubijałoby proces.
  let path;
  try { path = new URL(req.url || "/", "http://x").pathname; } catch { return send(res, 400, { error: "bad-request" }); }
  try {
    if (req.method === "GET" && path === "/health") return send(res, 200, { ok: true });
    // Klucz publiczny VAPID jest jawny z założenia, ale za tokenem nie ujawniamy, że to serwer powiadomień.
    if (req.method === "GET" && path === "/vapid") {
      if (!authorize(req, res, ip, now)) return;
      return send(res, 200, { publicKey: vapid.publicKey });
    }

    if (req.method === "PUT" && path === "/schedule") {
      if (!authorize(req, res, ip, now)) return;
      const body = await readJson(req);
      const subscription = cleanSubscription(body.subscription);
      if (!subscription) return send(res, 400, { error: "subscription" });
      const id = subKey(subscription.endpoint);
      const sub = perSubSchedule.hit(id, now);
      if (!sub.ok) return tooMany(res, sub.retryAfterSec);
      if (!store.subs[id] && Object.keys(store.subs).length >= LIMITS.subs) return send(res, 503, { error: "full" });
      const items = cleanItems(body.items, Date.now());
      store.subs[id] = { subscription, items, updated: Date.now() };
      save();
      return send(res, 200, { ok: true, items: items.length });
    }

    if (req.method === "POST" && path === "/unsubscribe") {
      if (!authorize(req, res, ip, now)) return;
      const body = await readJson(req);
      if (typeof body.endpoint === "string") {
        // Klucz liczymy ze znormalizowanego adresu, jak przy zapisie (`cleanSubscription`).
        delete store.subs[subKey(normalizeEndpoint(body.endpoint) ?? body.endpoint)];
        save();
      }
      return send(res, 200, { ok: true });
    }

    if (req.method === "POST" && path === "/test") {
      if (!authorize(req, res, ip, now)) return;
      const body = await readJson(req);
      // `cleanSubscription` przepuszcza tylko adresy serwisów push przeglądarek — nie da się tym kierować żądań gdzie indziej.
      const subscription = cleanSubscription(body.subscription);
      if (!subscription) return send(res, 400, { error: "subscription" });
      const id = subKey(subscription.endpoint);
      const sub = perSubTest.hit(id, now);
      if (!sub.ok) return tooMany(res, sub.retryAfterSec);
      const ok = await push(id, subscription, payloadOf({
        key: `test:${Date.now()}`, title: "Próbne powiadomienie", body: "Serwer powiadomień działa — przypomnienia przyjdą też przy zamkniętej aplikacji.", url: "/",
      }));
      return send(res, ok ? 200 : 502, { ok });
    }

    send(res, 404, { error: "not-found" });
  } catch (e) {
    // Do klienta tylko stały kod, nie treść wyjątku (mogłaby zdradzać ścieżki i szczegóły środowiska).
    if (e.message === "too-large") return send(res, 413, { error: "too-large" });
    if (e.message === "bad-json") return send(res, 400, { error: "bad-json" });
    console.error("Błąd obsługi żądania", req.method, path, e.message);
    send(res, 500, { error: "server-error" });
  }
}

const server = createServer((req, res) => {
  handle(req, res).catch((e) => {
    console.error("Nieobsłużony błąd żądania", e?.message);
    if (!res.headersSent) send(res, 500, { error: "server-error" }); else res.end();
  });
});

// Wolne albo wiszące połączenia (np. slowloris) nie mogą blokować serwera.
server.headersTimeout = 10_000;
server.requestTimeout = 20_000;
server.keepAliveTimeout = 5_000;
server.maxRequestsPerSocket = 100;
server.maxConnections = envInt("MAX_CONNECTIONS", 200);

// Bez tokenu nasłuchujemy tylko na localhost — nawet pomyłkowo nie wystawimy otwartego serwera do sieci.
server.listen(PORT, TOKEN ? undefined : "127.0.0.1", () => console.log(`Serwer powiadomień NOTKI na porcie ${PORT}${TOKEN ? "" : " (tylko localhost, bez uwierzytelniania)"}`));
setInterval(() => { tick().catch((e) => console.error("tick", e)); }, TICK_MS);
// Sprzątanie liczników limitów, żeby nie rosły bez końca.
setInterval(() => { const t = Date.now(); for (const l of [perIp, authFails, perSubSchedule, perSubTest]) l.sweep(t); }, 60_000).unref();

// Żaden nieprzewidziany błąd w jednym żądaniu nie może zabić procesu (a z nim wysyłki przypomnień).
process.on("unhandledRejection", (e) => console.error("unhandledRejection", e?.message ?? e));
