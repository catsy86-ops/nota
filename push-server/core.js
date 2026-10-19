// Czysta logika serwera powiadomień: walidacja tego, co przysyła aplikacja,
// i wybór terminów do wysłania. Bez sieci i bez dysku — testy w core.test.js.
import { createHash } from "node:crypto";

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
  /** Termin spóźniony bardziej niż tyle (np. serwer stał) przepada zamiast przyjść w nocy. */
  lateMs: 60 * 60 * 1000,
};

const str = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");

/** Krótki, stały identyfikator subskrypcji (adres endpointu jest długi i nie musi leżeć w logach). */
export function subKey(endpoint) {
  return createHash("sha256").update(endpoint).digest("hex").slice(0, 32);
}

/** Subskrypcja Web Push z `PushSubscription.toJSON()`; tylko https. */
export function cleanSubscription(raw) {
  if (!raw || typeof raw !== "object") return null;
  const { endpoint, keys } = raw;
  if (typeof endpoint !== "string" || endpoint.length > 1000 || !/^https:\/\//.test(endpoint)) return null;
  if (!keys || typeof keys.p256dh !== "string" || typeof keys.auth !== "string") return null;
  if (keys.p256dh.length > 200 || keys.auth.length > 100) return null;
  return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
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
