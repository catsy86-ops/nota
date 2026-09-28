// Dodatkowa logika powiadomień, wstrzykiwana do generowanego przez
// vite-plugin-pwa service workera (workbox.importScripts w vite.config.ts).
// Kliknięcie powiadomienia otwiera notatkę (`data.url`, np. /notatka/<id>):
// w otwartej karcie appki przez wiadomość do routera (bez przeładowania),
// a gdy żadnej nie ma — w nowym oknie pod tym adresem.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.postMessage({ type: "open-url", url });
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
