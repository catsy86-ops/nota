import type { PushItem } from "./schedule";

/**
 * Treść przypomnień niewidoczna dla serwera powiadomień (S3.1, `docs/plan-powiadomienia.md` §1).
 * Serwer dostaje `{ v: 1, key, at, enc }`: losowy `key`, jawną chwilę `at` i szyfrogram AES-256-GCM tekstu
 * `{"k","t","b","u","s"}` dopełnionego spacjami do wielokrotności 256 bajtów. Odszyfrowuje service worker
 * (`public/sw-notifications.js`) kluczem z tej samej bazy IndexedDB.
 */

export const PUSH_KEYS_DB = "kaczy-push-keys";
const STORE = "keys";
const CONTENT_KEY = "content-v1";
/** Wpis zostawiany przez worker, gdy nie odszyfrował powiadomienia: strona wysyła listę od nowa. */
const RESEND_KEY = "resend";

export const SEAL_BLOCK = 256;
export const SEAL_MAX_BYTES = 1536;
const AAD_PREFIX = "kaczy-push-v1:";
/** Limity znaków jak na serwerze dla starego formatu (`push-server/core.js`, `LIMITS`). */
const MAX = { title: 120, body: 240, url: 300, key: 120 };

export interface SealedPushItem {
  v: 1;
  key: string;
  at: number;
  enc: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PUSH_KEYS_DB, 1);
    // Ten sam `onupgradeneeded` co w workerze: którakolwiek strona otworzy bazę pierwsza, magazyn powstanie.
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(tx.error ?? new Error("IndexedDB"));
  });
}

async function read<T>(db: IDBDatabase, id: string): Promise<T | undefined> {
  const tx = db.transaction(STORE, "readonly");
  const req = tx.objectStore(STORE).get(id);
  await done(tx);
  return req.result as T | undefined;
}

/**
 * Klucz treści tego urządzenia: nieeksportowalny AES-GCM 256 w IndexedDB. `created` — klucz powstał teraz
 * (pierwsze użycie albo utrata klucza): wcześniejsze szyfrogramy na serwerze są nieczytelne, listę trzeba wysłać od nowa.
 */
export async function contentKey(): Promise<{ key: CryptoKey; created: boolean }> {
  const db = await openDb();
  try {
    const existing = await read<CryptoKey>(db, CONTENT_KEY);
    if (existing) return { key: existing, created: false };
    // Klucz przed transakcją: transakcja IndexedDB nie przeżyje `await generateKey`.
    const fresh = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    let stored: CryptoKey | undefined;
    // Dwie karty naraz: odczyt i zapis w jednej transakcji; wygrywa ten, kto zapisał pierwszy.
    const get = store.get(CONTENT_KEY);
    get.onsuccess = () => {
      stored = get.result as CryptoKey | undefined;
      if (!stored) store.put(fresh, CONTENT_KEY);
    };
    await done(tx);
    return stored ? { key: stored, created: false } : { key: fresh, created: true };
  } finally {
    db.close();
  }
}

/** Czy worker zgłosił nieodszyfrowane powiadomienie; zdejmuje zgłoszenie. Błąd bazy = nie. */
export async function takeResendRequest(): Promise<boolean> {
  try {
    const db = await openDb();
    try {
      const flag = await read<number>(db, RESEND_KEY);
      if (flag === undefined) return false;
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(RESEND_KEY);
      await done(tx);
      return true;
    } finally {
      db.close();
    }
  } catch {
    return false;
  }
}

/** Usuwa bazę kluczy („Usuń wszystkie dane”). */
export function deletePushKeys(): Promise<void> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(PUSH_KEYS_DB);
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}

const utf8 = new TextEncoder();

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Skraca napis do `max` punktów kodowych (nie jednostek UTF-16 — połówka pary zastępczej to zły tekst). */
const clip = (s: string, max: number) => {
  const cps = Array.from(s);
  return cps.length > max ? cps.slice(0, max).join("") : s;
};

/**
 * Tekst jawny pozycji: przycięty do limitów, ≤ `SEAL_MAX_BYTES` bajtów UTF-8 i dopełniony spacjami do wielokrotności
 * `SEAL_BLOCK` — długość szyfrogramu nie zdradza długości tytułu. Najpierw skraca treść, potem tytuł; adresu i klucza
 * nie skraca (za długi adres → „/”).
 */
export function sealPlaintext(item: PushItem): Uint8Array {
  let t = Array.from(clip(item.title, MAX.title));
  let b = Array.from(clip(item.body, MAX.body));
  let u = item.url.length > MAX.url ? "/" : item.url;
  const k = clip(item.key, MAX.key);
  const json = () => JSON.stringify({ k, t: t.join(""), b: b.join(""), u, ...(item.snooze ? { s: 1 } : {}) });
  let bytes = utf8.encode(json());
  while (bytes.length > SEAL_MAX_BYTES) {
    if (b.length) b = b.slice(0, -1);
    else if (t.length) t = t.slice(0, -1);
    else if (u !== "/") u = "/";
    else break;
    bytes = utf8.encode(json());
  }
  const padded = new Uint8Array(Math.min(SEAL_MAX_BYTES, Math.max(SEAL_BLOCK, Math.ceil(bytes.length / SEAL_BLOCK) * SEAL_BLOCK)));
  padded.fill(0x20);
  padded.set(bytes.subarray(0, padded.length));
  return padded;
}

export const sealAad = (outerKey: string) => utf8.encode(AAD_PREFIX + outerKey);

/** Szyfruje jedną pozycję; zewnętrzny `key` i `iv` są losowe przy każdym wywołaniu. */
export async function sealItem(key: CryptoKey, item: PushItem): Promise<SealedPushItem> {
  const outer = base64url(crypto.getRandomValues(new Uint8Array(16)));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: sealAad(outer) }, key, sealPlaintext(item)));
  const out = new Uint8Array(iv.length + cipher.length);
  out.set(iv);
  out.set(cipher, iv.length);
  return { v: 1, key: outer, at: item.at, enc: base64url(out) };
}

export const sealItems = (key: CryptoKey, items: PushItem[]) => Promise.all(items.map((i) => sealItem(key, i)));
