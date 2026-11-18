import { pushPrefs, pushToken, updatePushPrefs } from "./prefs";
import type { PushItem } from "./schedule";
import { contentKey, sealItems, takeResendRequest } from "./seal";

/**
 * Subskrypcja Web Push i wysyłka harmonogramu na serwer (`push-server/server.js`):
 * `GET /vapid`, `PUT /schedule`, `POST /test`, `POST /unsubscribe`.
 */

export type PushSupport = "ok" | "unsupported" | "ios-browser";

export function pushSupport(): PushSupport {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    // iOS daje Web Push tylko aplikacji dodanej do ekranu początkowego.
    const ios = typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent);
    return ios ? "ios-browser" : "unsupported";
  }
  return "ok";
}

function keyBytes(base64url: string): Uint8Array {
  const b64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

const sameKey = (a: ArrayBuffer | null | undefined, b: Uint8Array) =>
  !!a && a.byteLength === b.byteLength && new Uint8Array(a).every((v, i) => v === b[i]);

/** Komunikat dla kodu odpowiedzi serwera (`push-server/server.js`): 401 zły token, 429 za dużo żądań. */
export function pushErrorText(status: number): string {
  if (status === 401) return "Serwer odrzucił token. Sprawdź token serwera w Ustawieniach.";
  if (status === 429) return "Serwer ogranicza liczbę żądań. Spróbuj za chwilę.";
  if (status === 413) return "Harmonogram jest za duży dla serwera.";
  return `Serwer odpowiedział ${status}`;
}

async function call(server: string, path: string, method: string, body?: unknown, keepalive = false, token = pushToken.get()): Promise<Response> {
  let res: Response;
  const headers: Record<string, string> = {};
  if (body) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    res = await fetch(`${server}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      keepalive,
      // Zawieszony serwer nie może blokować wysyłki w nieskończoność (D8 audytu).
      ...(typeof AbortSignal !== "undefined" && "timeout" in AbortSignal ? { signal: AbortSignal.timeout(15_000) } : {}),
    });
  } catch {
    throw new Error("Brak połączenia z serwerem powiadomień.");
  }
  if (!res.ok) throw new Error(pushErrorText(res.status));
  return res;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/**
 * Włącza powiadomienia: zgoda, klucz serwera, subskrypcja. Wołać z kliknięcia —
 * prośba o zgodę idzie przed pierwszym `await`, bo przeglądarka wymaga gestu.
 */
export async function enablePush(server: string, token = ""): Promise<void> {
  const permission = Notification.requestPermission();
  if ((await permission) !== "granted") throw new Error("Brak zgody na powiadomienia w przeglądarce.");
  const { publicKey, enc } = (await (await call(server, "/vapid", "GET", undefined, false, token)).json()) as { publicKey?: string; enc?: number };
  if (typeof publicKey !== "string") throw new Error("To nie jest serwer powiadomień G.");
  const key = keyBytes(publicKey);
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  // Subskrypcja innego serwera (zmieniony adres albo klucze) — nowa.
  if (sub && !sameKey(sub.options.applicationServerKey, key)) {
    await sub.unsubscribe();
    sub = null;
  }
  if (!sub) await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  // Token sprawdzamy żądaniem wymagającym uwierzytelnienia, zanim włączymy push: zły token od razu da czytelny błąd,
  // a nie „harmonogram nie wysłany” po chwili. Pusta lista terminów nic nie zmienia na serwerze poza subskrypcją.
  const subscription = (await reg.pushManager.getSubscription())?.toJSON();
  if (subscription) await call(server, "/schedule", "PUT", { subscription, items: [] }, false, token);
  pushToken.set(token);
  updatePushPrefs({ server, enabled: true, sentHash: undefined, last: undefined, enc: enc === 1, encAt: Date.now() });
}

export async function disablePush(): Promise<void> {
  const { server } = pushPrefs.get();
  updatePushPrefs({ enabled: false, sentHash: undefined, last: undefined });
  const sub = await currentSubscription().catch(() => null);
  if (!sub) return;
  // Serwer może być niedostępny — subskrypcja i tak wygaśnie u niego przy pierwszej wysyłce (410).
  await call(server, "/unsubscribe", "POST", { endpoint: sub.endpoint }).catch(() => undefined);
  await sub.unsubscribe().catch(() => undefined);
}

export async function sendTestPush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) throw new Error("Brak subskrypcji — włącz powiadomienia jeszcze raz.");
  await call(pushPrefs.get().server, "/test", "POST", { subscription: sub.toJSON() });
}

function hashOf(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}

/** Przeglądarki ograniczają sumę treści żądań `keepalive` do 64 KB; zostawiamy zapas na nagłówki. */
export const KEEPALIVE_MAX_BYTES = 60 * 1024;

/**
 * Najdłuższy początek listy (lista jest po czasie), którego treść żądania mieści się w `maxBytes` (S3 audytu 2).
 * Resztę dośle zwykła wysyłka przy następnym otwarciu aplikacji.
 */
export function fitKeepalive<T>(body: (items: T[]) => unknown, items: T[], maxBytes = KEEPALIVE_MAX_BYTES): T[] {
  const enc = new TextEncoder();
  const size = (n: number) => enc.encode(JSON.stringify(body(items.slice(0, n)))).length;
  if (size(items.length) <= maxBytes) return items;
  let lo = 0;
  let hi = items.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (size(mid) <= maxBytes) lo = mid;
    else hi = mid - 1;
  }
  return items.slice(0, lo);
}

/** Po tylu godzinach wysyłamy listę ponownie, nawet bez zmian — przesuwa się horyzont i serwer mógł stracić dane. */
const RESEND_MS = 6 * 60 * 60 * 1000;

/** Wysyłki idą jedna po drugiej: dwa nakładające się wywołania nie zapiszą `sentHash` w odwrotnej kolejności (D8). */
let uploadQueue: Promise<void> = Promise.resolve();

/** Wysyła harmonogram, jeśli się zmienił. `keepalive` — przy chowaniu aplikacji. */
export function uploadSchedule(items: PushItem[], keepalive = false): Promise<void> {
  const run = uploadQueue.then(() => uploadNow(items, keepalive));
  uploadQueue = run.catch(() => undefined);
  return run;
}

/** Odświeża `enc` (czy serwer przyjmuje format zaszyfrowany) co `RESEND_MS`; błąd zostawia poprzednią wartość. */
async function refreshEnc(server: string): Promise<void> {
  const { encAt } = pushPrefs.get();
  if (encAt && Date.now() - encAt < RESEND_MS) return;
  try {
    const { enc } = (await (await call(server, "/vapid", "GET")).json()) as { enc?: number };
    updatePushPrefs({ enc: enc === 1, encAt: Date.now() });
  } catch {
    /* sprawdzimy przy następnej wysyłce */
  }
}

const fail = (error: string) => updatePushPrefs({ sentHash: undefined, last: { at: Date.now(), ok: false, error } });

async function uploadNow(items: PushItem[], keepalive: boolean): Promise<void> {
  if (!pushPrefs.get().enabled) return;
  // Worker nie odszyfrował powiadomienia (inny klucz) — serwer ma nieczytelne pozycje, wysyłamy listę od nowa.
  if (await takeResendRequest()) updatePushPrefs({ sentHash: undefined });
  if (!keepalive) await refreshEnc(pushPrefs.get().server);
  const prefs = pushPrefs.get();
  const sub = await currentSubscription().catch(() => null);
  if (!sub) {
    updatePushPrefs({ last: { at: Date.now(), ok: false, error: "Subskrypcja wygasła — włącz powiadomienia jeszcze raz." } });
    return;
  }
  const subscription = sub.toJSON();
  const enc = prefs.enc === true;
  let sealed: unknown[] = items;
  let sentHash = prefs.sentHash;
  if (enc) {
    try {
      const { key, created } = await contentKey();
      // Nowy klucz (pierwszy raz albo utracony): pozycje na serwerze są nieczytelne — wysyłka mimo tej samej listy.
      if (created) sentHash = undefined;
      sealed = await sealItems(key, items);
    } catch {
      // Serwer przyjmuje szyfrogramy, a tu nie da się szyfrować: nie wysyłamy treści jawnie.
      fail("Nie udało się zaszyfrować przypomnień w tej przeglądarce — nie zostały wysłane.");
      return;
    }
  }
  // Skrót z pozycji jawnych: losowe `iv` i `key` dawałyby inne bajty przy każdym przebiegu.
  const hash = hashOf(JSON.stringify([subscription.endpoint, enc, items]));
  const fresh = prefs.last?.ok && Date.now() - prefs.last.at < RESEND_MS;
  if (hash === sentHash && fresh) return;
  const sent = keepalive ? fitKeepalive((list) => ({ subscription, items: list }), sealed) : sealed;
  try {
    const res = await call(prefs.server, "/schedule", "PUT", { subscription, items: sent }, keepalive);
    const accepted = (await res.json().catch(() => ({}))) as { items?: number };
    const now = Date.now();
    const future = items.slice(0, sent.length).filter((i) => i.at > now).length;
    // Serwer po cichu odrzuca pozycje, których nie rozumie (np. stary serwer i szyfrogramy).
    if (typeof accepted.items === "number" && accepted.items < future) {
      fail("Serwer nie przyjął części przypomnień.");
      return;
    }
    // Obcięta wysyłka nie zapisuje skrótu — następna zwykła wyśle pełną listę.
    updatePushPrefs({ sentHash: sent.length === items.length ? hash : undefined, last: { at: now, ok: true, count: sent.length } });
  } catch (e) {
    fail(e instanceof Error ? e.message : "Brak połączenia z serwerem.");
  }
}
