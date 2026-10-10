// Dodatkowa logika powiadomień, wstrzykiwana do generowanego przez
// vite-plugin-pwa service workera (workbox.importScripts w vite.config.ts).
// Kliknięcie powiadomienia otwiera notatkę (`data.url`, np. /notatka/<id>):
// w otwartej karcie appki przez wiadomość do routera (bez przeładowania),
// a gdy żadnej nie ma — w nowym oknie pod tym adresem.
// Przyciski akcji („Odłóż 10 min”, „Gotowe”) idą do otwartej karty jako
// `notification-action` — dokument Yjs żyje w stronie, nie w workerze.
// Gdy karty nie ma, akcja otwiera aplikację pod adresem notatki.
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
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
