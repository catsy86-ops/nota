// Dodatkowa logika powiadomień, wstrzykiwana do generowanego przez
// vite-plugin-pwa service workera (workbox.importScripts w vite.config.ts).
// Kliknięcie powiadomienia otwiera notatkę (`data.url`, np. /notatka/<id>):
// w otwartej karcie appki przez wiadomość do routera (bez przeładowania),
// a gdy żadnej nie ma — w nowym oknie pod tym adresem.
// Przyciski akcji („Odłóż 10 min”, „Gotowe”) idą do otwartej karty jako
// `notification-action` — dokument Yjs żyje w stronie, nie w workerze.
// Gdy karty nie ma, akcja otwiera aplikację pod adresem notatki.
// Web Push z serwera `push-server/` — przypomnienie przy zamkniętej aplikacji.
// Klucz terminu trafia do Cache Storage (`notki-push` / `/__push-shown`, jak w
// `src/lib/push/shown.ts`): strona otwarta później nie pokaże go drugi raz,
// a termin już pokazany przez stronę nie przyjdzie drugi raz z serwera.
const PUSH_CACHE = "notki-push";
const PUSH_SHOWN = "/__push-shown";

async function pushShownList() {
  try {
    const res = await (await caches.open(PUSH_CACHE)).match(PUSH_SHOWN);
    const list = res ? await res.json() : [];
    return Array.isArray(list) ? list.filter((k) => typeof k === "string") : [];
  } catch (e) { return []; }
}

async function markPushShown(key) {
  try {
    const list = (await pushShownList()).filter((k) => k !== key);
    list.push(key);
    await (await caches.open(PUSH_CACHE)).put(PUSH_SHOWN, new Response(JSON.stringify(list.slice(-200)), { headers: { "Content-Type": "application/json" } }));
  } catch (e) { /* bez Cache Storage — co najwyżej podwójne powiadomienie */ }
}

self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = {}; }
  const title = typeof d.title === "string" && d.title ? d.title : "NOTKI";
  const url = typeof d.url === "string" && /^\/(?![/\\])/.test(d.url) ? d.url : "/";
  const key = typeof d.key === "string" ? d.key : "";
  const tag = key ? key.split(":").slice(0, 2).join(":") : "push";
  event.waitUntil((async () => {
    const test = key.startsWith("test:");
    if (key && !test) {
      if ((await pushShownList()).includes(key)) return;
      // Otwarta i widoczna aplikacja przypomina sama (dymek + powiadomienie z timera strony).
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (clients.some((c) => c.visibilityState === "visible")) return;
      await markPushShown(key);
    }
    // Przypomnienie z notatki (`n:<id>:<termin>`) dostaje te same przyciski co powiadomienie ze strony.
    const noteId = key.startsWith("n:") ? key.split(":")[1] || "" : "";
    const actions = noteId
      ? [...(d.snooze === true ? [{ action: "snooze10", title: "Odłóż 10 min" }] : []), { action: "done", title: "Gotowe" }]
      : [];
    await self.registration.showNotification(title, {
      body: typeof d.body === "string" ? d.body : "",
      icon: "/pwa-192.png",
      badge: "/pwa-192.png",
      tag,
      renotify: true,
      vibrate: [120, 60, 120],
      data: noteId ? { url, key, noteId } : { url, key },
      actions,
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  // Tylko ścieżka w obrębie aplikacji — `//host` i `/\host` wychodziłyby poza nią.
  const url = typeof data.url === "string" && /^\/(?![/\\])/.test(data.url) ? data.url : "/";
  const action = event.action || "";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          if (action && data.noteId) {
            client.postMessage({ type: "notification-action", action, noteId: data.noteId });
            // Odłożenie i „Gotowe” nie wymagają przełączania na kartę.
            if (action !== "open") return;
          }
          client.postMessage({ type: "open-url", url });
          return client.focus();
        }
      }
      // Bez otwartej karty akcja nie może zmienić dokumentu w workerze — aplikacja otwiera się
      // z `?akcja=…` i wykonuje ją po wczytaniu notatek (`useReminderNotifications`).
      const target = action && action !== "open" && data.noteId ? `${url}${url.includes("?") ? "&" : "?"}akcja=${encodeURIComponent(action)}` : url;
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
