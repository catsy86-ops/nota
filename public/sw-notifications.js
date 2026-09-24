// Dodatkowa logika powiadomień, wstrzykiwana do generowanego przez
// vite-plugin-pwa service workera (workbox.importScripts w vite.config.ts).
// Obsługuje kliknięcie powiadomienia: fokusuje istniejącą kartę appki
// albo otwiera nową, jeśli żadna nie jest otwarta.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("/");
    })
  );
});
