import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { uploadSchedule } from "./client";
import { pushPrefs, updatePushPrefs } from "./prefs";
import type { PushItem } from "./schedule";
import { contentKey, deletePushKeys, PUSH_KEYS_DB, SEAL_BLOCK, SEAL_MAX_BYTES, sealAad, sealItem, sealPlaintext, takeResendRequest } from "./seal";

const AT = Date.now() + 3_600_000;
const item = (over: Partial<PushItem> = {}): PushItem => ({ key: "n:abc:1", at: AT, title: "Tytuł", body: "Treść", url: "/notatka/abc", ...over });

const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));

async function open(key: CryptoKey, outer: string, enc: string) {
  const raw = fromB64url(enc);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: raw.slice(0, 12), additionalData: sealAad(outer) }, key, raw.slice(12));
  return JSON.parse(new TextDecoder().decode(plain).trimEnd()) as Record<string, unknown>;
}

beforeEach(async () => {
  await deletePushKeys();
});

describe("push/seal (S3.1)", () => {
  it("sealItem: odszyfrowanie daje te same pola; inny key w AAD i zmieniony bajt nie przechodzą", async () => {
    const { key, created } = await contentKey();
    expect(created).toBe(true);
    const sealed = await sealItem(key, item({ snooze: true }));
    expect(sealed).toMatchObject({ v: 1 });
    expect(sealed.key).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(await open(key, sealed.key, sealed.enc)).toEqual({ k: "n:abc:1", t: "Tytuł", b: "Treść", u: "/notatka/abc", s: 1 });
    await expect(open(key, "B".repeat(22), sealed.enc)).rejects.toThrow();
    const bytes = fromB64url(sealed.enc);
    bytes[20] ^= 1;
    const tampered = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    await expect(open(key, sealed.key, tampered)).rejects.toThrow();
  });

  it("klucz: drugi odczyt zwraca ten sam, nieeksportowalny", async () => {
    const a = await contentKey();
    const b = await contentKey();
    expect(b.created).toBe(false);
    expect(b.key.extractable).toBe(false);
    const sealed = await sealItem(a.key, item());
    expect((await open(b.key, sealed.key, sealed.enc)).t).toBe("Tytuł");
  });

  it("przycięcie: emoji na granicy — poprawny UTF-8, ≤ 1536 bajtów, wielokrotność 256", () => {
    const emoji = "😀".repeat(500);
    const plain = sealPlaintext(item({ title: emoji, body: emoji, url: "/" + "x".repeat(400) }));
    expect(plain.length % SEAL_BLOCK).toBe(0);
    expect(plain.length).toBeLessThanOrEqual(SEAL_MAX_BYTES);
    const text = new TextDecoder("utf-8", { fatal: true }).decode(plain);
    const parsed = JSON.parse(text.trimEnd()) as { t: string; b: string; u: string };
    expect(parsed.u).toBe("/");
    expect(Array.from(parsed.t).length).toBe(120);
    expect(parsed.b).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
    // Długa treść z escapami JSON (cudzysłowy) skraca się do limitu bajtów.
    const quotes = sealPlaintext(item({ title: '"'.repeat(120), body: '"'.repeat(240) }));
    expect(quotes.length).toBeLessThanOrEqual(SEAL_MAX_BYTES);
  });

  it("dwie pozycje o różnej długości tytułu dają enc tej samej długości", async () => {
    const { key } = await contentKey();
    const a = await sealItem(key, item({ title: "A" }));
    const b = await sealItem(key, item({ title: "Znacznie dłuższy tytuł przypomnienia o czymś ważnym" }));
    expect(a.enc.length).toBe(b.enc.length);
  });

  it("takeResendRequest: wpis od workera jest zdejmowany", async () => {
    expect(await takeResendRequest()).toBe(false);
    await contentKey();
    await new Promise<void>((resolve) => {
      const req = indexedDB.open(PUSH_KEYS_DB, 1);
      req.onsuccess = () => {
        const tx = req.result.transaction("keys", "readwrite");
        tx.objectStore("keys").put(Date.now(), "resend");
        tx.oncomplete = () => { req.result.close(); resolve(); };
      };
    });
    expect(await takeResendRequest()).toBe(true);
    expect(await takeResendRequest()).toBe(false);
  });
});

describe("push/client z szyfrowaniem", () => {
  const toJSON = () => ({ endpoint: "https://push.example/abc", keys: { p256dh: "p", auth: "a" } });
  beforeEach(() => {
    const sub = { endpoint: "https://push.example/abc", toJSON };
    Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { ready: Promise.resolve({ pushManager: { getSubscription: async () => sub } }) } });
  });
  afterEach(() => vi.unstubAllGlobals());

  type Call = [string, RequestInit];
  const puts = (m: ReturnType<typeof vi.fn>) => (m.mock.calls as unknown as Call[]).filter(([, init]) => init.method === "PUT").map(([, init]) => JSON.parse(String(init.body)) as { items: Record<string, unknown>[] });

  function server(enc: boolean, accept?: (n: number) => number) {
    return vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith("/vapid")) return new Response(JSON.stringify({ publicKey: "k", ...(enc ? { enc: 1 } : {}) }));
      const n = (JSON.parse(String(init.body)) as { items: unknown[] }).items.length;
      return new Response(JSON.stringify({ ok: true, items: accept ? accept(n) : n }));
    });
  }

  it("serwer bez enc: 1 → stary format; z enc: 1 → żadna pozycja nie ma title", async () => {
    updatePushPrefs({ server: "https://srv.example", enabled: true, sentHash: undefined, last: undefined, enc: undefined, encAt: undefined });
    const plain = server(false);
    vi.stubGlobal("fetch", plain);
    await uploadSchedule([item()]);
    expect(puts(plain)[0].items[0]).toMatchObject({ title: "Tytuł" });

    updatePushPrefs({ sentHash: undefined, encAt: undefined });
    const sealed = server(true);
    vi.stubGlobal("fetch", sealed);
    await uploadSchedule([item()]);
    const sent = puts(sealed)[0].items[0];
    expect(sent).toMatchObject({ v: 1 });
    expect(sent).not.toHaveProperty("title");
    expect(pushPrefs.get().enc).toBe(true);
  });

  it("sentHash z pozycji jawnych: ta sama lista dwa razy — jedna wysyłka", async () => {
    updatePushPrefs({ server: "https://srv.example", enabled: true, sentHash: undefined, last: undefined, enc: true, encAt: Date.now() });
    const f = server(true);
    vi.stubGlobal("fetch", f);
    await uploadSchedule([item()]);
    await uploadSchedule([item()]);
    expect(puts(f)).toHaveLength(1);
  });

  it("utrata klucza: następna wysyłka idzie mimo niezmienionej listy", async () => {
    updatePushPrefs({ server: "https://srv.example", enabled: true, sentHash: undefined, last: undefined, enc: true, encAt: Date.now() });
    const f = server(true);
    vi.stubGlobal("fetch", f);
    await uploadSchedule([item()]);
    await deletePushKeys();
    await uploadSchedule([item()]);
    expect(puts(f)).toHaveLength(2);
  });

  it("serwer przyjął mniej pozycji niż wysłano → błąd", async () => {
    updatePushPrefs({ server: "https://srv.example", enabled: true, sentHash: undefined, last: undefined, enc: false, encAt: Date.now() });
    vi.stubGlobal("fetch", server(false, () => 0));
    await uploadSchedule([item()]);
    expect(pushPrefs.get().last).toMatchObject({ ok: false, error: "Serwer nie przyjął części przypomnień." });
    expect(pushPrefs.get().sentHash).toBeUndefined();
  });

  it("brak możliwości szyfrowania przy enc: 1 — nic nie wysyła jawnie", async () => {
    updatePushPrefs({ server: "https://srv.example", enabled: true, sentHash: undefined, last: undefined, enc: true, encAt: Date.now() });
    const f = server(true);
    vi.stubGlobal("fetch", f);
    vi.spyOn(crypto.subtle, "encrypt").mockRejectedValueOnce(new Error("brak"));
    await uploadSchedule([item()]);
    expect(puts(f)).toHaveLength(0);
    expect(pushPrefs.get().last?.ok).toBe(false);
    vi.restoreAllMocks();
  });
});
