// Czysta logika serwera powiadomień: walidacja tego, co przysyła aplikacja,
// i wybór terminów do wysłania. Bez sieci i bez dysku — testy w core.test.js.
import { createHash, timingSafeEqual } from "node:crypto";
import { parse as legacyParse } from "node:url";

export const LIMITS = {
  /** Terminów na jedno urządzenie (subskrypcję). */
  items: 200,
  /** Subskrypcji na serwerze — chroni dysk przed zapchaniem. */
  subs: 100,
  title: 120,
  body: 240,
  url: 300,
  key: 120,
  /** Jak daleko w przód można zaplanować termin. */
  horizonMs: 35 * 24 * 60 * 60 * 1000,
  /** Subskrypcja bez żadnej aktywności (ostatni `PUT /schedule`) tak długo jest uznawana za martwą i sprzątana. */
  staleMs: 60 * 24 * 60 * 60 * 1000,
  /** Termin spóźniony bardziej niż tyle (np. serwer stał) przepada zamiast przyjść w nocy. */
  lateMs: 60 * 60 * 1000,
};

const str = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");

/** Krótki, stały identyfikator subskrypcji (adres endpointu jest długi i nie musi leżeć w logach). */
export function subKey(endpoint) {
  return createHash("sha256").update(endpoint).digest("hex").slice(0, 32);
}

// Serwisy Web Push przeglądarek. Endpoint spoza tej listy odrzucamy: bez niej `/test` i `/schedule`
// wysyłałyby żądania na dowolny adres https (otwarty przekaźnik).
const PUSH_SERVICE_HOSTS = [
  /^fcm\.googleapis\.com$/, // Chrome, Android
  /(^|\.)push\.services\.mozilla\.com$/, // Firefox
  /(^|\.)notify\.windows\.com$/, // Edge, Windows
  /(^|\.)push\.apple\.com$/, // Safari, iOS
];

// Etykiety DNS: litery, cyfry i myślniki. Parser WHATWG przepuszcza w nazwie hosta m.in. `;`, `!`, `$`, a `web-push`
// używa starszego `url.parse`, który kończy nazwę hosta na `;` — adres `https://127.0.0.1;x.notify.windows.com/`
// przeszedłby allowlistę, a żądanie poszłoby na 127.0.0.1. Dlatego host sprawdzamy ścisłym wzorcem.
const DNS_HOST = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

/**
 * Adres endpointu w postaci znormalizowanej (`href`) albo `null`. Warunki: ASCII bez znaków sterujących, spacji
 * i `\`, https, port 443, bez danych logowania, host z listy serwisów Web Push zapisany jako poprawne etykiety DNS
 * — i ten sam host oraz port widziane przez `url.parse` (tym parserem wysyła `web-push`). Serwer wysyła żądanie
 * dokładnie pod zwracany adres, więc każde poluzowanie to otwarty przekaźnik (SSRF).
 */
export function normalizeEndpoint(endpoint) {
  if (typeof endpoint !== "string" || endpoint.length === 0 || endpoint.length > 1000) return null;
  if (/[\u0000-\u0020\u007f-\uffff\\]/.test(endpoint)) return null;
  let url;
  try { url = new URL(endpoint); } catch { return null; }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  if (url.port && url.port !== "443") return null;
  if (!DNS_HOST.test(url.hostname) || !PUSH_SERVICE_HOSTS.some((re) => re.test(url.hostname))) return null;
  const legacy = legacyParse(url.href);
  if (legacy.protocol !== "https:" || legacy.hostname !== url.hostname) return null;
  if (legacy.port !== null && legacy.port !== "443") return null;
  if (typeof legacy.path !== "string" || !legacy.path.startsWith("/")) return null;
  return url.href;
}

/** Czy adres przechodzi `normalizeEndpoint`. */
export const isPushServiceUrl = (endpoint) => normalizeEndpoint(endpoint) !== null;

/** Subskrypcja Web Push z `PushSubscription.toJSON()`; tylko https z serwisu push. */
export function cleanSubscription(raw) {
  if (!raw || typeof raw !== "object") return null;
  const { endpoint, keys } = raw;
  const href = normalizeEndpoint(endpoint);
  if (!href) return null;
  if (!keys || typeof keys.p256dh !== "string" || typeof keys.auth !== "string") return null;
  if (keys.p256dh.length > 200 || keys.auth.length > 100) return null;
  // Zapisujemy i wysyłamy znormalizowany adres, nie surowy napis od klienta.
  return { endpoint: href, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

/**
 * Terminy z aplikacji: `{ key, at, title, body?, url? }`. Odrzuca przeszłe, zbyt odległe
 * i bez tytułu; adres tylko w obrębie aplikacji (`/…`). Ten sam klucz — zostaje pierwszy.
 */
export function cleanItems(raw, now) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const key = str(r.key, LIMITS.key);
    const title = str(r.title, LIMITS.title).trim();
    const at = r.at;
    if (!key || !title || seen.has(key)) continue;
    if (typeof at !== "number" || !Number.isFinite(at) || at <= now || at > now + LIMITS.horizonMs) continue;
    const url = str(r.url, LIMITS.url);
    seen.add(key);
    // `snooze` — powiadomienie dostaje „Odłóż 10 min” (także przy serii: odkłada tylko to wystąpienie).
    out.push({ key, at, title, body: str(r.body, LIMITS.body), url: /^\/(?![/\\])/.test(url) ? url : "/", snooze: r.snooze === true });
    if (out.length >= LIMITS.items) break;
  }
  return out.sort((a, b) => a.at - b.at);
}

/**
 * Terminy do wysłania teraz. `send` — do wysłania, `drop` — spóźnione ponad `lateMs`
 * (serwer nie działał): lepiej przepuścić niż budzić przypomnieniem sprzed godzin.
 */
export function dueItems(store, now) {
  const send = [];
  const drop = [];
  for (const [id, sub] of Object.entries(store.subs)) {
    for (const item of sub.items) {
      if (item.at > now) continue;
      (now - item.at > LIMITS.lateMs ? drop : send).push({ id, item });
    }
  }
  return { send, drop };
}

/** Treść wiadomości push — czyta ją `public/sw-notifications.js`. */
export function payloadOf(item) {
  return JSON.stringify({ title: item.title, body: item.body, url: item.url, key: item.key, snooze: item.snooze === true });
}

/** Usuwa wysłane/przepadłe terminy (po kluczu) z subskrypcji. */
export function removeItems(store, id, keys) {
  const sub = store.subs[id];
  if (!sub) return;
  const gone = new Set(keys);
  sub.items = sub.items.filter((i) => !gone.has(i.key));
}

export function emptyStore() {
  return { subs: {} };
}

/** Wczytany plik: wszystko, co się nie zgadza, wypada (ręczna edycja, stara wersja). */
export function cleanStore(raw, now) {
  const store = emptyStore();
  if (!raw || typeof raw !== "object" || !raw.subs || typeof raw.subs !== "object") return store;
  for (const sub of Object.values(raw.subs)) {
    const subscription = cleanSubscription(sub && sub.subscription);
    if (!subscription) continue;
    // Spóźnione o mniej niż `lateMs` zostają — wyśle je pierwszy obieg.
    const items = cleanItems(sub.items, now - LIMITS.lateMs);
    store.subs[subKey(subscription.endpoint)] = { subscription, items, updated: Number(sub.updated) || now };
  }
  return store;
}

// ── Uwierzytelnianie, CORS i limity żądań (czyste funkcje; sieć jest w server.js) ─────────────────────

/** Token porównywany w stałym czasie (przez skróty o tej samej długości), żeby czas odpowiedzi nie zdradzał prefiksu. */
export function tokenOk(provided, expected) {
  if (typeof provided !== "string" || typeof expected !== "string" || !expected) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/** Token z nagłówka `Authorization: Bearer …`; pusty = brak albo zły format. */
export function bearerOf(header) {
  const m = /^Bearer\s+(\S{1,512})$/i.exec(typeof header === "string" ? header : "");
  return m ? m[1] : "";
}

/** `ALLOWED_ORIGINS` → lista adresów; pusta = żadna strona z innej domeny nie ma dostępu (CORS wyłączony). */
export const parseOrigins = (raw) => String(raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);

/** Wartość `Access-Control-Allow-Origin` dla żądania albo `null` (bez nagłówka CORS). `*` tylko, gdy wpisano go wprost. */
export function corsOrigin(origin, allowed) {
  if (allowed.includes("*")) return "*";
  return typeof origin === "string" && allowed.includes(origin) ? origin : null;
}

/**
 * Adres klienta do limitów. Za zaufanym reverse proxy (`TRUST_PROXY=1`) bierzemy OSTATNI wpis `X-Forwarded-For`
 * (dopisany przez nasze proxy); pierwszy dałoby się podrobić nagłówkiem od klienta i obejść limit.
 */
export function clientIp(remote, forwardedFor, trustProxy) {
  if (trustProxy && typeof forwardedFor === "string") {
    const parts = forwardedFor.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1].slice(0, 64);
  }
  return remote || "unknown";
}

/**
 * Limit „najwyżej `max` zdarzeń w oknie `windowMs`” na klucz (adres, subskrypcja). `check` tylko sprawdza,
 * `record` zapisuje, `hit` = oba. Liczba kluczy jest ograniczona, żeby sam limiter nie zjadł pamięci.
 */
export function createRateLimiter({ windowMs, max, maxKeys = 10_000 }) {
  const hits = new Map();
  const fresh = (key, now) => (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  const result = (arr, now) => (arr.length >= max
    ? { ok: false, retryAfterSec: Math.max(1, Math.ceil((arr[0] + windowMs - now) / 1000)) }
    : { ok: true, retryAfterSec: 0 });
  const api = {
    check(key, now) { return result(fresh(key, now), now); },
    record(key, now) {
      const arr = fresh(key, now);
      arr.push(now);
      hits.set(key, arr);
      if (hits.size > maxKeys) api.sweep(now, true);
    },
    hit(key, now) {
      const r = api.check(key, now);
      if (r.ok) api.record(key, now);
      return r;
    },
    /** Usuwa wygasłe klucze; `force` przy przepełnieniu zostawia tylko najnowszą połowę. */
    sweep(now, force = false) {
      for (const [k, arr] of hits) {
        const keep = arr.filter((t) => now - t < windowMs);
        if (keep.length) hits.set(k, keep); else hits.delete(k);
      }
      if (force && hits.size > maxKeys) {
        const newest = [...hits.entries()].sort((a, b) => b[1][b[1].length - 1] - a[1][a[1].length - 1]).slice(0, Math.floor(maxKeys / 2));
        hits.clear();
        for (const [k, v] of newest) hits.set(k, v);
      }
    },
    size: () => hits.size,
  };
  return api;
}

/** Martwe subskrypcje (np. po ponownym włączeniu powiadomień na telefonie zostaje stary adres): do usunięcia. */
export function staleSubs(store, now) {
  return Object.entries(store.subs).filter(([, sub]) => now - (Number(sub.updated) || 0) > LIMITS.staleMs).map(([id]) => id);
}

/**
 * Jeden obieg wysyłki: usuwa nieaktywne subskrypcje, wysyła terminy, które nadeszły, i porzuca spóźnione. Samą wysyłkę
 * (`sendOne(id, subscription, payload)` → "ok" | "gone" | "error") wstrzykuje serwer, więc obieg da się testować bez sieci.
 * Nieudana wysyłka nie jest ponawiana; "gone" (404/410) usuwa subskrypcję. Zwraca `true`, gdy trzeba zapisać stan.
 */
export async function tickStore(store, now, sendOne) {
  let dirty = false;
  for (const id of staleSubs(store, now)) { delete store.subs[id]; dirty = true; }
  const { send, drop } = dueItems(store, now);
  for (const { id, item } of drop) removeItems(store, id, [item.key]);
  for (const { id, item } of send) {
    const sub = store.subs[id];
    if (!sub) continue;
    removeItems(store, id, [item.key]);
    if ((await sendOne(id, sub.subscription, payloadOf(item))) === "gone") delete store.subs[id];
  }
  return dirty || send.length > 0 || drop.length > 0;
}
