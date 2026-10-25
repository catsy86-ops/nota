/**
 * Klucze powiadomień wspólne dla strony i serwera push oraz pamięć „już pokazane”.
 * Ten sam termin może przyjść dwiema drogami: z serwera (aplikacja zamknięta) i z timera
 * strony (aplikacja otwarta albo otwarta później). Obie zapisują klucz w Cache Storage,
 * które widzi i strona, i service worker (`public/sw-notifications.js` — te same nazwy).
 */
export const SHOWN_CACHE = "notki-push";
export const SHOWN_URL = "/__push-shown";
const SHOWN_MAX = 200;

export const pushKey = {
  note: (id: string, at: number) => `n:${id}:${at}`,
  evening: (forKey: string) => `e:${forKey}`,
  reportDay: (dayKey: string) => `rd:${dayKey}`,
  reportWeek: (weekKey: string) => `rw:${weekKey}`,
  problem: (entryId: string) => `p:${entryId}`,
  order: (shortageId: string, since: number) => `o:${shortageId}:${since}`,
  delivery: (shortageId: string, due: number) => `d:${shortageId}:${due}`,
  service: (callId: string, due: string) => `v:${callId}:${due}`,
};

async function readShown(): Promise<string[]> {
  if (typeof caches === "undefined") return [];
  try {
    const res = await (await caches.open(SHOWN_CACHE)).match(SHOWN_URL);
    const list: unknown = res ? await res.json() : [];
    return Array.isArray(list) ? list.filter((k): k is string => typeof k === "string") : [];
  } catch { return []; }
}

export async function wasShown(key: string): Promise<boolean> {
  return (await readShown()).includes(key);
}

export async function markShown(key: string): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    const list = (await readShown()).filter((k) => k !== key);
    list.push(key);
    const cache = await caches.open(SHOWN_CACHE);
    await cache.put(SHOWN_URL, new Response(JSON.stringify(list.slice(-SHOWN_MAX)), { headers: { "Content-Type": "application/json" } }));
  } catch { /* bez Cache Storage — co najwyżej podwójne powiadomienie */ }
}
