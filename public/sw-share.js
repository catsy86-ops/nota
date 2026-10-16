// Web Share Target z plikami (POST multipart na /share), wstrzykiwane do
// service workera obok sw-notifications.js (workbox.importScripts w vite.config.ts).
// Manifest kieruje udostępnienie z innej aplikacji na POST /share. Tu nie ma
// jeszcze aplikacji do odpowiedzi, więc odkładamy dane do Cache Storage pod
// identyfikatorem i przekierowujemy na `/share?inbox=<id>` (303 → GET). Stronę
// odbiera `takeShareInbox` (src/lib/shareInbox.ts) i zawsze kasuje wpis.
// Klucze wpisu muszą zgadzać się z tamtym plikiem: `/share-inbox/<id>/meta`
// (JSON: title, text, url, files) i `/share-inbox/<id>/f<i>` (bajty pliku,
// nazwa URI-zakodowana w nagłówku `x-name`).
const SHARE_INBOX_CACHE = "share-inbox-v1";

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "POST" || url.origin !== self.location.origin) return;
  if (url.pathname.replace(/\/+$/, "") !== "/share") return;
  event.respondWith(storeShare(event.request));
});

async function storeShare(request) {
  const fail = () => Response.redirect(new URL("/share?inbox=0", self.location.origin).href, 303);
  try {
    const form = await request.formData();
    const text = (k) => {
      const v = form.get(k);
      return typeof v === "string" ? v.slice(0, 20000) : "";
    };
    const files = form.getAll("files").filter((f) => f instanceof File);
    const id = crypto.randomUUID();
    const base = `/share-inbox/${id}`;
    const cache = await caches.open(SHARE_INBOX_CACHE);
    // Meta na końcu: bez niej strona nie odbiera nic, więc przerwany zapis nie da notatki bez plików.
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      await cache.put(`${base}/f${i}`, new Response(f, {
        headers: { "content-type": f.type || "application/octet-stream", "x-name": encodeURIComponent(f.name || "plik") },
      }));
    }
    const meta = { title: text("title").slice(0, 200), text: text("text"), url: text("url").slice(0, 2000), files: files.length };
    await cache.put(`${base}/meta`, new Response(JSON.stringify(meta), { headers: { "content-type": "application/json" } }));
    return Response.redirect(new URL(`/share?inbox=${id}`, self.location.origin).href, 303);
  } catch {
    return fail();
  }
}
