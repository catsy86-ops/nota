import { markShown, wasShown } from "@/lib/push/shown";

/**
 * Powiadomienie systemowe przez rejestrację service workera (spójniej na
 * Androidzie niż gołe `new Notification()`), z awaryjnym `Notification`.
 * Nie robi nic bez zgody. `actions` działają tylko przez SW — obsługuje je
 * `public/sw-notifications.js` i przekazuje otwartej karcie jako wiadomość.
 */
export interface SystemNotificationOptions {
  body: string;
  tag: string;
  /** Adres otwierany po stuknięciu w powiadomienie. */
  url: string;
  actions?: { action: string; title: string }[];
  /** Dodatkowe dane przekazywane do obsługi akcji (np. `noteId`). */
  data?: Record<string, unknown>;
  /** Zostaje na ekranie do reakcji — dla terminów, które nie mogą przepaść. */
  requireInteraction?: boolean;
  silent?: boolean;
  /**
   * Klucz terminu (`pushKey` w `lib/push/shown.ts`): jeśli to samo powiadomienie przyszło już
   * z serwera push (aplikacja była zamknięta), drugi raz go nie pokazujemy.
   */
  key?: string;
}

export function showSystemNotification(title: string, o: SystemNotificationOptions): void {
  if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return;
  if (o.key) {
    const key = o.key;
    void wasShown(key).then(async (shown) => {
      if (shown) return;
      await markShown(key);
      show(title, o);
    });
    return;
  }
  show(title, o);
}

function show(title: string, o: SystemNotificationOptions): void {
  const options: NotificationOptions & { actions?: unknown; vibrate?: number[] } = {
    body: o.body,
    icon: "/pwa-192.png",
    badge: "/pwa-192.png",
    tag: o.tag,
    renotify: true,
    silent: o.silent,
    requireInteraction: o.requireInteraction,
    vibrate: o.silent ? undefined : [120, 60, 120],
    actions: o.actions,
    data: { ...o.data, url: o.url },
  };
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready
      .then((r) => r.showNotification(title, options))
      .catch(() => fallback(title, options, o.url));
  } else {
    fallback(title, options, o.url);
  }
}

function fallback(title: string, options: NotificationOptions, url: string): void {
  try {
    // `actions` jest dozwolone tylko w powiadomieniach SW.
    const { ...plain } = options as NotificationOptions & { actions?: unknown };
    delete plain.actions;
    const n = new Notification(title, plain);
    n.onclick = () => { window.focus(); window.location.assign(url); };
  } catch { /* przeglądarka bez konstruktora (Android) — dymek w aplikacji i tak się pokazał */ }
}
