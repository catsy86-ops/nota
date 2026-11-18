import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PushItem } from "./schedule";
import { contentKey, deletePushKeys, sealItem, takeResendRequest } from "./seal";

// `public/sw-notifications.js` uruchomiony z atrapą `self` (zdarzenie `push`, S3.1).
const SOURCE = readFileSync(resolve(__dirname, "../../../public/sw-notifications.js"), "utf8");

function loadWorker(visible = false) {
  const handlers: Record<string, (e: unknown) => void> = {};
  const shown: { title: string; options: NotificationOptions & { actions?: { action: string }[]; data?: { url: string } } }[] = [];
  const self = {
    addEventListener: (type: string, fn: (e: unknown) => void) => { handlers[type] = fn; },
    clients: { matchAll: async () => (visible ? [{ visibilityState: "visible" }] : []) },
    registration: { showNotification: vi.fn(async (title: string, options: never) => { shown.push({ title, options }); }) },
  };
  const cache = new Map<string, Response>();
  const caches = { open: async () => ({ match: async (k: string) => cache.get(k)?.clone(), put: async (k: string, r: Response) => { cache.set(k, r); } }) };
  new Function("self", "caches", "indexedDB", "crypto", SOURCE)(self, caches, indexedDB, crypto);
  async function push(data: unknown) {
    let waited: Promise<unknown> = Promise.resolve();
    handlers.push({ data: { json: () => data }, waitUntil: (p: Promise<unknown>) => { waited = p; } });
    await waited;
  }
  return { push, shown };
}

const item = (over: Partial<PushItem> = {}): PushItem => ({ key: "n:abc:1", at: Date.now() + 60_000, title: "Kupić rury", body: "Hurtownia", url: "/notatka/abc", snooze: true, ...over });
const wire = (s: { key: string; enc: string }) => ({ v: 1, key: s.key, enc: s.enc });

beforeEach(async () => {
  await deletePushKeys();
});

describe("sw-notifications: push zaszyfrowany (S3.1)", () => {
  it("poprawna pozycja → powiadomienie z przyciskami notatki", async () => {
    const { key } = await contentKey();
    const w = loadWorker();
    await w.push(wire(await sealItem(key, item())));
    expect(w.shown).toHaveLength(1);
    expect(w.shown[0].title).toBe("Kupić rury");
    expect(w.shown[0].options.body).toBe("Hurtownia");
    expect(w.shown[0].options.actions?.map((a) => a.action)).toEqual(["snooze10", "done"]);
    expect(w.shown[0].options.data?.url).toBe("/notatka/abc");
  });

  it("zły klucz → powiadomienie ogólne i wpis resend", async () => {
    const other = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    await contentKey();
    const w = loadWorker();
    await w.push(wire(await sealItem(other, item())));
    expect(w.shown).toHaveLength(1);
    expect(w.shown[0].title).toBe("NOTKI");
    expect(w.shown[0].options.body).toBe("Masz przypomnienie. Otwórz aplikację.");
    expect(w.shown[0].options.actions).toBeUndefined();
    expect(await takeResendRequest()).toBe(true);
  });

  it("bez klucza i przy widocznej aplikacji — nic nie pokazuje, ale zgłasza resend", async () => {
    const other = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    const sealed = await sealItem(other, item());
    const w = loadWorker(true);
    await w.push(wire(sealed));
    expect(w.shown).toHaveLength(0);
    expect(await takeResendRequest()).toBe(true);
  });

  it("u: //zly.host → adres /", async () => {
    const { key } = await contentKey();
    const w = loadWorker();
    await w.push(wire(await sealItem(key, item({ url: "//zly.host" }))));
    expect(w.shown[0].options.data?.url).toBe("/");
  });

  it("stary format bez zmian", async () => {
    const w = loadWorker();
    await w.push({ key: "test:1", title: "Próbne", body: "b", url: "/" });
    expect(w.shown[0].title).toBe("Próbne");
  });
});
