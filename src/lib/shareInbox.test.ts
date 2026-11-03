import { describe, it, expect } from "vitest";
import { takeShareInbox, importSharedFiles, isShareableAttachment, isShareableImage, sweepShareInbox } from "./shareInbox";
import type { ImageStore } from "./imageStore";

const ID = "3f2c1a9e-7b4d-4e8a-9c21-5d6e7f8a9b0c";
const base = `/share-inbox/${ID}`;

/** Atrapa Cache Storage: wpisy po ścieżce, bez przeglądarki. */
function fakeCache(entries: Record<string, Response>) {
  const map = new Map(Object.entries(entries));
  return {
    map,
    async match(key: string | Request) { return map.get(typeof key === "string" ? key : new URL(key.url).pathname)?.clone(); },
    async delete(key: string | Request) { return map.delete(typeof key === "string" ? key : new URL(key.url).pathname); },
    async keys() { return Array.from(map.keys(), (k) => new Request(`http://localhost${k}`)); },
  } as unknown as Cache & { map: Map<string, Response> };
}

function fileResponse(body: string, type: string, name: string) {
  return new Response(body, { headers: { "content-type": type, "x-name": encodeURIComponent(name) } });
}

describe("takeShareInbox", () => {
  it("odbiera tekst, link i pliki, po czym kasuje cały wpis", async () => {
    const cache = fakeCache({
      [`${base}/meta`]: new Response(JSON.stringify({ title: "Faktura", text: "Do zapłaty", url: "https://example.com/f", files: 2 })),
      [`${base}/f0`]: fileResponse("%PDF-1", "application/pdf", "faktura maj.pdf"),
      [`${base}/f1`]: fileResponse("img", "image/jpeg", "zdjęcie.jpg"),
    });
    const got = await takeShareInbox(ID, async () => cache);
    expect(got).not.toBeNull();
    expect(got!.query).toContain("title=Faktura");
    expect(got!.query).toContain("text=Do+zap%C5%82aty");
    expect(got!.files.map((f) => [f.name, f.type])).toEqual([
      ["faktura maj.pdf", "application/pdf"],
      ["zdjęcie.jpg", "image/jpeg"],
    ]);
    expect(cache.map.size).toBe(0);
  });

  it("udostępnienie bez tekstu daje pusty adres i same pliki", async () => {
    const cache = fakeCache({
      [`${base}/meta`]: new Response(JSON.stringify({ title: "", text: "", url: "", files: 1 })),
      [`${base}/f0`]: fileResponse("x", "application/pdf", "a.pdf"),
    });
    const got = await takeShareInbox(ID, async () => cache);
    expect(got?.query).toBe("");
    expect(got?.files).toHaveLength(1);
  });

  it("brak meta (przerwany zapis, zły identyfikator) → null, bez dotykania cache", async () => {
    expect(await takeShareInbox(ID, async () => fakeCache({}))).toBeNull();
    expect(await takeShareInbox("../../etc", async () => { throw new Error("nie powinno się wywołać"); })).toBeNull();
  });

  it("niedostępny Cache Storage → null", async () => {
    expect(await takeShareInbox(ID, async () => { throw new Error("brak"); })).toBeNull();
  });

  it("liczba plików z meta jest ograniczona", async () => {
    const cache = fakeCache({ [`${base}/meta`]: new Response(JSON.stringify({ files: 1e9 })) });
    const got = await takeShareInbox(ID, async () => cache);
    expect(got?.files).toEqual([]);
  });
});

describe("importSharedFiles", () => {
  const fakeStore = (): ImageStore => ({
    putBytes: async (_b: Uint8Array, _t: string, hash?: string) => hash ?? "h".repeat(64),
  } as unknown as ImageStore);

  it("PDF trafia do załączników, nieobsługiwane typy są nazwane", async () => {
    const pdf = new File(["%PDF-1.4 test"], "raport.pdf", { type: "application/pdf" });
    const txt = new File(["notatka"], "plik.txt", { type: "text/plain" });
    const res = await importSharedFiles([pdf, txt], new Map(), fakeStore());
    expect(res.attachments.map((a) => [a.name, a.type])).toEqual([["raport.pdf", "application/pdf"]]);
    expect(res.unsupported).toEqual(["plik.txt"]);
    expect(res.images).toEqual([]);
  });

  it("rozpoznaje typy: PDF i obrazy; reszta odpada", () => {
    expect(isShareableAttachment("application/pdf")).toBe(true);
    expect(isShareableAttachment("text/plain")).toBe(false);
    expect(isShareableImage("image/png")).toBe(true);
    expect(isShareableImage("application/pdf")).toBe(false);
  });
});

describe("sweepShareInbox (Plan-nowy 1.10)", () => {
  const NOW = 1_800_000_000_000;
  const at = (ms: number) => ({ headers: { "x-at": String(ms) } });

  it("kasuje wpisy starsze niż godzina i bez znacznika czasu, świeże zostawia", async () => {
    const cache = fakeCache({
      [`${base}/meta`]: new Response("{}", at(NOW - 5 * 60_000)),
      [`${base}/f0`]: new Response("x", at(NOW - 5 * 60_000)),
      "/share-inbox/stary/meta": new Response("{}", at(NOW - 2 * 60 * 60_000)),
      "/share-inbox/sprzed-limitu/f31": new Response("x"),
    });
    expect(await sweepShareInbox(async () => cache, NOW)).toBe(2);
    expect(Array.from(cache.map.keys()).sort()).toEqual([`${base}/f0`, `${base}/meta`]);
  });

  it("niedostępny Cache Storage → 0, bez błędu", async () => {
    expect(await sweepShareInbox(async () => { throw new Error("brak"); }, NOW)).toBe(0);
  });
});
