import { pushPrefs, updatePushPrefs } from "./prefs";
import type { PushItem } from "./schedule";

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

async function call(server: string, path: string, method: string, body?: unknown, keepalive = false): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${server}${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      keepalive,
    });
  } catch {
    throw new Error("Brak połączenia z serwerem powiadomień.");
  }
  if (!res.ok) throw new Error(`Serwer odpowiedział ${res.status}`);
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
export async function enablePush(server: string): Promise<void> {
  const permission = Notification.requestPermission();
  if ((await permission) !== "granted") throw new Error("Brak zgody na powiadomienia w przeglądarce.");
  const { publicKey } = (await (await call(server, "/vapid", "GET")).json()) as { publicKey?: string };
  if (typeof publicKey !== "string") throw new Error("To nie jest serwer powiadomień NOTKI.");
  const key = keyBytes(publicKey);
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  // Subskrypcja innego serwera (zmieniony adres albo klucze) — nowa.
  if (sub && !sameKey(sub.options.applicationServerKey, key)) {
    await sub.unsubscribe();
    sub = null;
  }
  if (!sub) await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  updatePushPrefs({ server, enabled: true, sentHash: undefined, last: undefined });
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

/** Po tylu godzinach wysyłamy listę ponownie, nawet bez zmian — przesuwa się horyzont i serwer mógł stracić dane. */
const RESEND_MS = 6 * 60 * 60 * 1000;

/** Wysyła harmonogram, jeśli się zmienił. `keepalive` — przy chowaniu aplikacji. */
export async function uploadSchedule(items: PushItem[], keepalive = false): Promise<void> {
  const prefs = pushPrefs.get();
  if (!prefs.enabled) return;
  const sub = await currentSubscription().catch(() => null);
  if (!sub) {
    updatePushPrefs({ last: { at: Date.now(), ok: false, error: "Subskrypcja wygasła — włącz powiadomienia jeszcze raz." } });
    return;
  }
  const subscription = sub.toJSON();
  const hash = hashOf(JSON.stringify([subscription.endpoint, items]));
  const fresh = prefs.last?.ok && Date.now() - prefs.last.at < RESEND_MS;
  if (hash === prefs.sentHash && fresh) return;
  try {
    await call(prefs.server, "/schedule", "PUT", { subscription, items }, keepalive);
    updatePushPrefs({ sentHash: hash, last: { at: Date.now(), ok: true, count: items.length } });
  } catch (e) {
    updatePushPrefs({ sentHash: undefined, last: { at: Date.now(), ok: false, error: e instanceof Error ? e.message : "Brak połączenia z serwerem." } });
  }
}
