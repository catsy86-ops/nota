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
  /** Kliknięcie powiadomienia bez otwartej karty: zwraca adres, pod którym worker otwiera okno. */
  async function click(data: unknown, action = "") {
    const opened: string[] = [];
    (self as { clients: Record<string, unknown> }).clients.openWindow = async (u: string) => { opened.push(u); };
    let waited: Promise<unknown> = Promise.resolve();
    handlers.notificationclick({ notification: { close: () => {}, data }, action, waitUntil: (p: Promise<unknown>) => { waited = p; } });
    await waited;
    return opened;
  }
  return { push, shown, click };
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

describe("sw-notifications: kliknięcie (S1.10)", () => {
  it.each([
    ["//zly.host/x", "/"],
    ["/\\zly.host", "/"],
    ["https://zly.host", "/"],
    ["javascript:alert(1)", "/"],
    ["notatka/abc", "/"],
    ["/notatka/abc", "/notatka/abc"],
  ])("data.url %j otwiera %j", async (url, expected) => {
    const w = loadWorker();
    expect(await w.click({ url })).toEqual([expected]);
  });

  it("brak data.url albo nie-napis → /", async () => {
    const w = loadWorker();
    expect(await w.click({})).toEqual(["/"]);
    expect(await w.click({ url: 5 })).toEqual(["/"]);
  });

  it("akcja z notatką dokleja ?akcja= do oczyszczonego adresu", async () => {
    const w = loadWorker();
    expect(await w.click({ url: "//zly.host", noteId: "abc" }, "done")).toEqual(["/?akcja=done"]);
  });
});

describe("service worker: importScripts tylko z własnych plików (S1.10)", () => {
  it("vite.config.ts i skrypty public/sw-*.js nie ładują kodu spoza źródła", () => {
    const vite = readFileSync(resolve(__dirname, "../../../vite.config.ts"), "utf8");
    const list = /importScripts:\s*\[([^\]]*)\]/.exec(vite)?.[1] ?? "";
    const entries = [...list.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) expect(e).toMatch(/^[\w.-]+\.js$/); // goła nazwa pliku: bez adresu, bez ścieżki w górę
    for (const f of ["sw-notifications.js", "sw-share.js"]) {
      const src = readFileSync(resolve(__dirname, "../../../public", f), "utf8");
      expect(src.replace(/\/\/.*$/gm, "")).not.toMatch(/importScripts\s*\(/);
    }
  });
});
