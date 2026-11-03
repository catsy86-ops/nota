// Web Share Target z plikami (POST multipart na /share), wstrzykiwane do
// service workera obok sw-notifications.js (workbox.importScripts w vite.config.ts).
// Manifest kieruje udostępnienie z innej aplikacji na POST /share. Tu nie ma
// jeszcze aplikacji do odpowiedzi, więc odkładamy dane do Cache Storage pod
// identyfikatorem i przekierowujemy na `/share?inbox=<id>` (303 → GET). Stronę
// odbiera `takeShareInbox` (src/lib/shareInbox.ts) i zawsze kasuje wpis.
// Klucze wpisu muszą zgadzać się z tamtym plikiem: `/share-inbox/<id>/meta`
// (JSON: title, text, url, files) i `/share-inbox/<id>/f<i>` (bajty pliku,
// nazwa URI-zakodowana w nagłówku `x-name`).
// Każdy wpis ma nagłówek `x-at` (czas zapisu), po którym aplikacja kasuje porzucone (`sweepShareInbox`).
const SHARE_INBOX_CACHE = "share-inbox-v1";
/** Tyle samo odbiera `takeShareInbox`; reszta nie trafia do cache, żeby nie leżała tam na zawsze. */
const MAX_FILES = 30;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "POST" || url.origin !== self.location.origin) return;
  if (url.pathname.replace(/\/+$/, "") !== "/share") return;
  // Formularz z obcej strony (CSRF) nie może dopisać notatki, która rozeszłaby się synchronizacją.
  // `Sec-Fetch-Site` nie dochodzi do service workera, `Origin` tak: formularz z tej aplikacji niesie
  // nasz origin, „Udostępnij” z systemu (nawigacja bez strony-inicjatora) — `null` albo nic.
  // Zostaje luka: strona z nieprzezroczystym originem (piaskownica, data:) też wysyła `null`.
  const from = event.request.headers.get("origin");
  if (from && from !== "null" && from !== self.location.origin) {
    event.respondWith(Response.redirect(new URL("/", self.location.origin).href, 303));
    return;
  }
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
    const all = form.getAll("files").filter((f) => f instanceof File);
    const files = [];
    let total = 0;
    for (const f of all) {
      if (files.length >= MAX_FILES || f.size > MAX_FILE_BYTES || total + f.size > MAX_TOTAL_BYTES) continue;
      files.push(f);
      total += f.size;
    }
    const id = crypto.randomUUID();
    const base = `/share-inbox/${id}`;
    const at = String(Date.now());
    const cache = await caches.open(SHARE_INBOX_CACHE);
    // Meta na końcu: bez niej strona nie odbiera nic, więc przerwany zapis nie da notatki bez plików.
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      await cache.put(`${base}/f${i}`, new Response(f, {
        headers: { "content-type": f.type || "application/octet-stream", "x-name": encodeURIComponent(f.name || "plik"), "x-at": at },
      }));
    }
    const meta = { title: text("title").slice(0, 200), text: text("text"), url: text("url").slice(0, 2000), files: files.length, skipped: all.length - files.length };
    await cache.put(`${base}/meta`, new Response(JSON.stringify(meta), { headers: { "content-type": "application/json", "x-at": at } }));
    return Response.redirect(new URL(`/share?inbox=${id}`, self.location.origin).href, 303);
  } catch {
    return fail();
  }
}
