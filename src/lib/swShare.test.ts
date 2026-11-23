import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// `public/sw-share.js` uruchomiony z atrapą `self` (S1.10): co trafia do skrzynki udostępnień, gdy POST /share przyjdzie
// z systemu, z naszej strony albo ze strony w piaskownicy (`Origin: null`).
const SOURCE = readFileSync(resolve(__dirname, "../../public/sw-share.js"), "utf8");
const ORIGIN = "http://localhost";

function loadWorker() {
  let onFetch: (e: unknown) => void = () => {};
  const self = { location: { origin: ORIGIN }, addEventListener: (_t: string, fn: (e: unknown) => void) => { onFetch = fn; } };
  const cache = new Map<string, Response>();
  const caches = { open: async () => ({ put: async (k: string, r: Response) => { cache.set(k, r); } }) };
  new Function("self", "caches", SOURCE)(self, caches);
  /** Zwraca odpowiedź workera (albo `null`, gdy zdarzenia nie przejął). */
  async function post(form: FormData, origin: string | null) {
    // Atrapa żądania: `Request` z jsdom nie serializuje jsdomowego `FormData`.
    const request = { method: "POST", url: `${ORIGIN}/share`, headers: { get: (k: string) => (k === "origin" ? origin : null) }, formData: async () => form };
    let response: Promise<Response> | null = null;
    onFetch({ request, respondWith: (p: Promise<Response>) => { response = p; } });
    return response ? await (response as Promise<Response>) : null;
  }
  const metaOf = async () => {
    const m = [...cache.entries()].find(([k]) => k.endsWith("/meta"));
    return m ? (await m[1].clone().json()) as { files: number; skipped: number } : null;
  };
  return { post, cache, metaOf };
}

const file = (name: string, type: string, size = 10) => new File([new Uint8Array(size)], name, { type });
const formWith = (...files: File[]) => { const f = new FormData(); f.append("title", "t"); files.forEach((x) => f.append("files", x)); return f; };

describe("sw-share (S1.10)", () => {
  it("przyjmuje obrazy i PDF, odsiewa resztę i liczy pominięte", async () => {
    const w = loadWorker();
    const res = await w.post(formWith(file("a.png", "image/png"), file("b.pdf", "application/pdf"), file("c.exe", "application/x-msdownload"), file("d.svg.html", "text/html"), file("e", "")), ORIGIN);
    expect(res?.status).toBe(303);
    expect(await w.metaOf()).toMatchObject({ files: 2, skipped: 3 });
  });

  it("plik ponad 10 MB jest pomijany", async () => {
    const w = loadWorker();
    await w.post(formWith(file("duży.png", "image/png", 10 * 1024 * 1024 + 1), file("mały.png", "image/png")), ORIGIN);
    expect(await w.metaOf()).toMatchObject({ files: 1, skipped: 1 });
  });

  it("obcy origin → przekierowanie na /, nic nie trafia do cache", async () => {
    const w = loadWorker();
    const res = await w.post(formWith(file("a.png", "image/png")), "https://zly.host");
    expect(res?.status).toBe(303);
    expect(res?.headers.get("location")).toBe(`${ORIGIN}/`);
    expect(w.cache.size).toBe(0);
  });

  it("Origin: null (piaskownica) przechodzi, ale tylko z limitami i filtrem typów — znana luka z komentarza w pliku", async () => {
    const w = loadWorker();
    await w.post(formWith(file("a.png", "image/png"), file("x.js", "text/javascript")), "null");
    expect(await w.metaOf()).toMatchObject({ files: 1, skipped: 1 });
  });

  it("POST z obcego originu bez plików też kończy się przekierowaniem", async () => {
    const w = loadWorker();
    expect((await w.post(formWith(), "https://zly.host"))?.status).toBe(303);
  });
});
