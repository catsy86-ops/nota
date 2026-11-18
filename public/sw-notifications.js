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

// Treść zaszyfrowana (S3.1, `src/lib/push/seal.ts`): `{ v: 1, key, enc }`, klucz AES-GCM w IndexedDB
// `kaczy-push-keys` / `keys` / `content-v1`. Gołe API `indexedDB` — ten skrypt ładuje `importScripts`.
const PUSH_KEYS_DB = "kaczy-push-keys";

function pushKeysDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PUSH_KEYS_DB, 1);
    // Ten sam `onupgradeneeded` co w stronie: worker może otworzyć bazę pierwszy.
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains("keys")) req.result.createObjectStore("keys");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function pushKeysTx(mode, fn) {
  const db = await pushKeysDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("keys", mode);
      const req = fn(tx.objectStore("keys"));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

function fromBase64url(s) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** Odszyfrowana pozycja w starym kształcie (`key/title/body/url/snooze`) albo wyjątek. */
async function openSealed(d) {
  if (typeof d.key !== "string" || !/^[A-Za-z0-9_-]{22}$/.test(d.key) || !/^[A-Za-z0-9_-]+$/.test(d.enc)) throw new Error("format");
  const key = await pushKeysTx("readonly", (store) => store.get("content-v1"));
  if (!key) throw new Error("brak klucza");
  const raw = fromBase64url(d.enc);
  const aad = new TextEncoder().encode("kaczy-push-v1:" + d.key);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: raw.slice(0, 12), additionalData: aad }, key, raw.slice(12));
  const p = JSON.parse(new TextDecoder().decode(plain).trimEnd());
  if (!p || typeof p !== "object") throw new Error("treść");
  return { key: p.k, title: p.t, body: p.b, url: p.u, snooze: p.s === 1 };
}

self.addEventListener("push", (event) => {
  let raw = {};
  try { raw = event.data ? event.data.json() : {}; } catch (e) { raw = {}; }
  event.waitUntil((async () => {
    let d = raw;
    if (raw && raw.v === 1 && typeof raw.enc === "string") {
      try {
        d = await openSealed(raw);
      } catch (e) {
        // Nie da się odszyfrować (inny albo brak klucza, zły znacznik, zły JSON): strona wyśle listę od nowa.
        try { await pushKeysTx("readwrite", (store) => store.put(Date.now(), "resend")); } catch (e2) { /* bez bazy */ }
        const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        // Widoczna aplikacja przypomina sama; inaczej powiadomienie ogólne (klucza terminu nie znamy — bez listy pokazanych).
        if (clients.some((c) => c.visibilityState === "visible")) return;
        await self.registration.showNotification("NOTKI", {
          body: "Masz przypomnienie. Otwórz aplikację.", icon: "/pwa-192.png", badge: "/pwa-192.png", tag: "push", data: { url: "/" },
        });
        return;
      }
    }
    if (!d || typeof d !== "object") d = {};
    const title = typeof d.title === "string" && d.title ? d.title : "NOTKI";
    const url = typeof d.url === "string" && /^\/(?![/\\])/.test(d.url) ? d.url : "/";
    const key = typeof d.key === "string" ? d.key : "";
    const tag = key ? key.split(":").slice(0, 2).join(":") : "push";
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
    // Koniec zmiany (G4.1): klucz `s:<dzień>` dostaje „Skończyłem”, które zapisze godzinę końca tego dnia.
    const shiftDay = /^s:\d{4}-\d{2}-\d{2}$/.test(key) ? key.slice(2) : "";
    const actions = noteId
      ? [...(d.snooze === true ? [{ action: "snooze10", title: "Odłóż 10 min" }] : []), { action: "done", title: "Gotowe" }]
      : shiftDay ? [{ action: "shift-done", title: "Skończyłem" }] : [];
    await self.registration.showNotification(title, {
      body: typeof d.body === "string" ? d.body : "",
      icon: "/pwa-192.png",
      badge: "/pwa-192.png",
      tag,
      renotify: true,
      vibrate: [120, 60, 120],
      data: noteId ? { url, key, noteId } : shiftDay ? { url, key, shiftDay } : { url, key },
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
  // „Skończyłem” przy końcu zmiany: aplikacja zapisuje godzinę (`hooks/useShiftEndAction.ts`). Bez otwartej karty
  // otwieramy Grafik z parametrami, a aplikacja wykonuje akcję po wczytaniu danych.
  if (action === "shift-done" && typeof data.shiftDay === "string") {
    const dayKey = data.shiftDay;
    event.waitUntil(
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
        const client = clients.find((c) => "focus" in c);
        if (client) {
          client.postMessage({ type: "shift-action", action, dayKey });
          return client.focus();
        }
        if (self.clients.openWindow) return self.clients.openWindow(`/grafik?akcja=shift-done&dzien=${encodeURIComponent(dayKey)}`);
      })
    );
    return;
  }
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
