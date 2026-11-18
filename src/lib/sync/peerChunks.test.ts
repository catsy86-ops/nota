import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { attachChunking, chunkProvider, CHUNK_FROM, CHUNK_SIZE, createAssembler, encodeChunks, isChunkFrame, type PeerLike } from "./peerChunks";

const bytes = (n: number, seed = 1) => Uint8Array.from({ length: n }, (_, i) => (i * 31 + seed) & 0xff);

/** Para atrap `simple-peer`: wysyłka jednej trafia do słuchaczy drugiej; limit wiadomości jak w Chrome. */
function pair() {
  const mk = () => {
    const ls: ((d: Uint8Array) => void)[] = [];
    const p: PeerLike & { other?: PeerLike & { deliver(d: Uint8Array): void }; deliver(d: Uint8Array): void; sent: number[] } = {
      sent: [],
      send(d: Uint8Array) {
        if (d.length > 256 * 1024) throw new TypeError("za duża wiadomość");
        this.sent.push(d.length);
        p.other!.deliver(d);
      },
      deliver(d: Uint8Array) { for (const l of [...ls]) l(d); },
      listeners: () => [...ls],
      removeAllListeners: () => { ls.length = 0; },
      on: (_e: "data", fn: (d: Uint8Array) => void) => { ls.push(fn); },
      destroy: vi.fn(),
      _channel: { bufferedAmount: 0 },
    };
    return p;
  };
  const a = mk();
  const b = mk();
  a.other = b;
  b.other = a;
  return { a, b };
}

describe("encodeChunks / createAssembler", () => {
  it("dzieli i składa z powrotem w dowolnej kolejności ramek", () => {
    const msg = bytes(5 * CHUNK_SIZE + 123);
    const frames = encodeChunks(msg, 7);
    expect(frames).toHaveLength(6);
    expect(frames.every(isChunkFrame)).toBe(true);
    const push = createAssembler({ maxBytes: 1 << 24 });
    const order = [3, 0, 5, 1, 4, 2];
    const results = order.map((i) => push(frames[i]));
    expect(results.slice(0, 5).every((r) => r.kind === "wait")).toBe(true);
    const last = results[5];
    expect(last.kind).toBe("pass");
    expect(last.kind === "pass" && Buffer.from(last.data).equals(Buffer.from(msg))).toBe(true);
  });

  it("zwykła wiadomość przechodzi bez zmian", () => {
    const push = createAssembler({ maxBytes: 1 << 20 });
    const m = Uint8Array.of(0, 2, 5, 6);
    expect(push(m)).toEqual({ kind: "pass", data: m });
  });

  it("za duża wiadomość zamyka połączenie po samych nagłówkach", () => {
    const push = createAssembler({ maxBytes: 4 * CHUNK_SIZE });
    const frames = encodeChunks(bytes(10 * CHUNK_SIZE), 1);
    expect(push(frames[0]).kind).toBe("close");
  });

  it("sprzeczne nagłówki i zbyt wiele naraz → close; powtórzona ramka czeka", () => {
    const push = createAssembler({ maxBytes: 1 << 24 });
    const a = encodeChunks(bytes(3 * CHUNK_SIZE), 1);
    expect(push(a[0]).kind).toBe("wait");
    expect(push(a[0]).kind).toBe("wait");
    const other = encodeChunks(bytes(2 * CHUNK_SIZE), 1);
    expect(push(other[0]).kind).toBe("close");
    const many = createAssembler({ maxBytes: 1 << 24 });
    for (let id = 1; id <= 4; id++) expect(many(encodeChunks(bytes(2 * CHUNK_SIZE), id)[0]).kind).toBe("wait");
    expect(many(encodeChunks(bytes(2 * CHUNK_SIZE), 9)[0]).kind).toBe("close");
  });

  it("niedokończone składanie wygasa po minucie", () => {
    let t = 0;
    const push = createAssembler({ maxBytes: 1 << 24, now: () => t });
    for (let id = 1; id <= 4; id++) push(encodeChunks(bytes(2 * CHUNK_SIZE), id)[0]);
    t = 61_000;
    expect(push(encodeChunks(bytes(2 * CHUNK_SIZE), 9)[0]).kind).toBe("wait");
  });
});

describe("attachChunking", () => {
  it("10 MiB przechodzi przez łącze z limitem 256 KiB; kolejność z małymi wiadomościami zostaje", async () => {
    const { a, b } = pair();
    const got: Uint8Array[] = [];
    b.on("data", (d) => got.push(d));
    a.on("data", () => {});
    expect(attachChunking(a, { maxBytes: 1 << 26 }, "a")).toBe(true);
    expect(attachChunking(b, { maxBytes: 1 << 26 }, "b")).toBe(true);
    const big = bytes(10 * 1024 * 1024, 3);
    a.send(Uint8Array.of(0, 0, 1));
    a.send(big);
    a.send(Uint8Array.of(0, 2, 9));
    await vi.waitFor(() => expect(got).toHaveLength(3));
    expect(got[0]).toEqual(Uint8Array.of(0, 0, 1));
    expect(Buffer.from(got[1]).equals(Buffer.from(big))).toBe(true);
    expect(got[2]).toEqual(Uint8Array.of(0, 2, 9));
    expect(Math.max(...a.sent)).toBeLessThanOrEqual(CHUNK_SIZE + 14);
  });

  it("mała wiadomość idzie od razu, bez ramek (zgodność ze starszą wersją)", () => {
    const { a, b } = pair();
    const got: Uint8Array[] = [];
    b.on("data", (d) => got.push(d));
    attachChunking(a, { maxBytes: 1 << 20 }, "a");
    a.send(bytes(CHUNK_FROM - 1));
    expect(a.sent).toEqual([CHUNK_FROM - 1]);
    expect(got).toHaveLength(1);
  });

  it("nieznany kształt (nie jeden słuchacz data) → false; chunkProvider wtedy zamyka połączenie", () => {
    const { a } = pair();
    expect(attachChunking(a, { maxBytes: 1 }, "a")).toBe(false);
    const peers: ((e: { added: string[] }) => void)[] = [];
    const conns = new Map([["x", { peer: a }]]);
    chunkProvider({ room: { webrtcConns: conns }, on: (_e, fn) => { peers.push(fn); } }, { maxBytes: 1 }, "t");
    peers[0]({ added: ["x"] });
    expect(a.destroy).toHaveBeenCalled();
  });

  it("ramka spoza limitu zamyka połączenie odbiorcy", () => {
    const { a, b } = pair();
    b.on("data", () => {});
    attachChunking(b, { maxBytes: CHUNK_SIZE }, "b");
    a.send(encodeChunks(bytes(4 * CHUNK_SIZE), 5)[0]);
    expect(b.destroy).toHaveBeenCalled();
  });
});

describe("kanarek y-webrtc (wnętrze biblioteki, na którym stoi owinięcie)", () => {
  const src = readFileSync(resolve(__dirname, "../../../node_modules/y-webrtc/src/y-webrtc.js"), "utf8");
  it("wersja przypięta dokładnie na 10.3.0", () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, "../../../package.json"), "utf8")) as { dependencies: Record<string, string> };
    expect(pkg.dependencies["y-webrtc"]).toBe("10.3.0");
    const lib = JSON.parse(readFileSync(resolve(__dirname, "../../../node_modules/y-webrtc/package.json"), "utf8")) as { version: string };
    expect(lib.version).toBe("10.3.0");
  });
  it("jeden słuchacz data na połączeniu, `peers` z `added` zaraz po `new WebrtcConn`, wysyłka przez `peer.send`", () => {
    expect(src.match(/this\.peer\.on\('data'/g)).toHaveLength(1);
    expect(src).toMatch(/setIfUndefined\(webrtcConns, data\.from, \(\) => new WebrtcConn\(this, true, data\.from, room\)\)\s*\n\s*emitPeerChange\(\)/);
    expect(src).toMatch(/added: \[data\.from\]/);
    expect(src).toMatch(/webrtcConn\.peer\.send\(/);
    expect(src).toMatch(/conn\.peer\.send\(m\)/);
  });
});
