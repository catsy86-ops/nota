import { describe, expect, it, vi } from "vitest";
import { classify, DOC_LIMITS, IMAGE_LIMITS, newGuardState, PAUSE_MS, PeerCloseCounter } from "./peerGuard";
import { attachChunking, type PeerLike } from "./peerChunks";

const KiB = 1024;
const MiB = 1024 * KiB;
const msg = (type: number, sub: number, len: number) => {
  const b = new Uint8Array(len);
  b[0] = type;
  if (len > 1) b[1] = sub;
  return b;
};
const run = (b: Uint8Array, times = 1, l = DOC_LIMITS) => {
  const s = newGuardState();
  let v = classify(b, s, l, 1_000_000);
  for (let i = 1; i < times; i++) v = classify(b, s, l, 1_000_000 + i);
  return v.kind;
};

describe("classify — tabela §1.4 (tuż pod i tuż nad progiem)", () => {
  it("krok 1: rozmiar i częstość", () => {
    expect(run(msg(0, 0, 64 * KiB))).toBe("pass");
    expect(run(msg(0, 0, 64 * KiB + 1))).toBe("close");
    expect(run(msg(0, 0, 10), 6)).toBe("pass");
    expect(run(msg(0, 0, 10), 7)).toBe("close");
  });

  it("krok 2: rozmiar i częstość", () => {
    expect(run(msg(0, 1, 100), 6)).toBe("pass");
    expect(run(msg(0, 1, 100), 7)).toBe("close");
    const s = newGuardState();
    expect(classify(msg(0, 1, 2), s, { ...DOC_LIMITS, step2Max: 2 }, 0).kind).toBe("pass");
    expect(classify(msg(0, 1, 3), s, { ...DOC_LIMITS, step2Max: 2 }, 0).kind).toBe("close");
  });

  it("aktualizacja: rozmiar, liczba i bajty na minutę", () => {
    expect(run(msg(0, 2, 4 * MiB))).toBe("pass");
    expect(run(msg(0, 2, 4 * MiB + 1))).toBe("close");
    expect(run(msg(0, 2, 10), 600)).toBe("pass");
    expect(run(msg(0, 2, 10), 601)).toBe("close");
    const l = { ...DOC_LIMITS, bytesPerMin: 100 };
    const s = newGuardState();
    expect(classify(msg(0, 2, 60), s, l, 0).kind).toBe("pass");
    expect(classify(msg(0, 2, 40), s, l, 1).kind).toBe("pass");
    expect(classify(msg(0, 2, 1), s, l, 2).kind).toBe("close");
    // Po minucie okno się przesuwa.
    expect(classify(msg(0, 2, 60), s, l, 60_001).kind).toBe("pass");
  });

  it("awareness: za duże i za częste są pomijane, trzecie pominięcie w minucie zamyka", () => {
    expect(run(msg(1, 0, 4 * KiB))).toBe("pass");
    expect(run(msg(1, 0, 4 * KiB + 1))).toBe("drop");
    expect(run(msg(1, 0, 10), 30)).toBe("pass");
    expect(run(msg(1, 0, 10), 31)).toBe("drop");
    expect(run(msg(1, 0, 5 * KiB), 2)).toBe("drop");
    expect(run(msg(1, 0, 5 * KiB), 3)).toBe("close");
  });

  it("pytanie o awareness: pomijane ponad 6 na minutę i ponad 2 bajty", () => {
    expect(run(msg(3, 0, 1), 6)).toBe("pass");
    expect(run(msg(3, 0, 1), 7)).toBe("drop");
    expect(run(msg(3, 0, 3))).toBe("drop");
  });

  it("typ 4, nieznane, pusta i zły podtyp synchronizacji zamykają", () => {
    expect(run(msg(4, 0, 5))).toBe("close");
    expect(run(msg(200, 0, 5))).toBe("close");
    expect(run(new Uint8Array(0))).toBe("close");
    expect(run(msg(0, 7, 5))).toBe("close");
  });

  it("obrazy: duża pierwsza wymiana przechodzi, bez limitu bajtów na minutę", () => {
    expect(run(msg(0, 1, 100 * MiB), 1, IMAGE_LIMITS)).toBe("pass");
    expect(run(msg(1, 0, 4 * KiB + 1), 1, IMAGE_LIMITS)).toBe("drop");
  });
});

describe("PeerCloseCounter", () => {
  it("trzy zamknięcia w 10 minut wstrzymują na 15 minut; drugie wstrzymanie w dobie jest liczone", () => {
    const c = new PeerCloseCounter();
    expect(c.record(0)).toBe(false);
    expect(c.record(1000)).toBe(false);
    expect(c.record(2000)).toBe(true);
    expect(c.paused(2000 + PAUSE_MS - 1)).toBe(true);
    expect(c.paused(2000 + PAUSE_MS)).toBe(false);
    expect(c.pausesToday(3000)).toBe(1);
    const t = 2000 + PAUSE_MS;
    c.record(t); c.record(t + 1);
    expect(c.record(t + 2)).toBe(true);
    expect(c.pausesToday(t + 3)).toBe(2);
  });

  it("zamknięcia rozłożone ponad 10 minut nie wstrzymują; „Wznów” zeruje", () => {
    const c = new PeerCloseCounter();
    c.record(0); c.record(5 * 60_000);
    expect(c.record(11 * 60_000)).toBe(false);
    c.record(11 * 60_000 + 1);
    c.resume();
    expect(c.paused(11 * 60_000 + 2)).toBe(false);
  });
});

describe("strażnik na połączeniu", () => {
  function peer() {
    const ls: ((d: Uint8Array) => void)[] = [];
    const p: PeerLike & { deliver(d: Uint8Array): void } = {
      send: () => {},
      deliver(d) { for (const l of [...ls]) l(d); },
      listeners: () => [...ls],
      removeAllListeners: () => { ls.length = 0; },
      on: (_e, fn) => { ls.push(fn); },
      destroy: vi.fn(),
      _channel: { bufferedAmount: 0 },
    };
    return p;
  }

  it("aktualizacja 10 MB jest odrzucana po samej długości — oryginalny słuchacz (applyUpdate) nie jest wołany", () => {
    const p = peer();
    const original = vi.fn();
    p.on("data", original);
    const onClose = vi.fn();
    attachChunking(p, { maxBytes: DOC_LIMITS.step2Max }, "t", { limits: DOC_LIMITS, onClose });
    p.deliver(msg(0, 2, 10 * 1000 * 1000));
    expect(original).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledWith(expect.stringContaining("aktualizacja"));
    expect(p.destroy).toHaveBeenCalled();
  });

  it("pominięte awareness nie dochodzi, poprawne dochodzi; nadmiar stanów po przepuszczeniu zamyka", () => {
    const p = peer();
    const original = vi.fn();
    p.on("data", original);
    let tooMany = false;
    attachChunking(p, { maxBytes: MiB }, "t", { limits: DOC_LIMITS, onClose: () => {}, afterAwareness: () => tooMany });
    p.deliver(msg(1, 0, 5 * KiB));
    expect(original).not.toHaveBeenCalled();
    p.deliver(msg(1, 0, 10));
    expect(original).toHaveBeenCalledTimes(1);
    expect(p.destroy).not.toHaveBeenCalled();
    tooMany = true;
    p.deliver(msg(1, 0, 10));
    expect(p.destroy).toHaveBeenCalled();
  });
});

describe("błąd przy nakładaniu", () => {
  it("wyjątek oryginalnego słuchacza zamyka połączenie i liczy się jako naruszenie", () => {
    const ls: ((d: Uint8Array) => void)[] = [];
    const p: PeerLike = {
      send: () => {}, listeners: () => [...ls], removeAllListeners: () => { ls.length = 0; },
      on: (_e, fn) => { ls.push(fn); }, destroy: vi.fn(), _channel: { bufferedAmount: 0 },
    };
    p.on("data", () => { throw new Error("zepsuta aktualizacja"); });
    const onClose = vi.fn();
    attachChunking(p, { maxBytes: MiB }, "t", { limits: DOC_LIMITS, onClose });
    ls[0](msg(0, 2, 10));
    expect(onClose).toHaveBeenCalledWith("błąd dekodowania");
    expect(p.destroy).toHaveBeenCalled();
  });
});

describe("trimAwareness", () => {
  it("ponad 64 stany: nadmiar usunięty (nigdy własny), wynik true", async () => {
    const { Awareness } = await import("y-protocols/awareness");
    const { trimAwareness } = await import("@/lib/yjsSync");
    const Y = await import("yjs");
    const a = new Awareness(new Y.Doc());
    a.setLocalState({ me: 1 });
    for (let i = 0; i < 80; i++) { a.states.set(1000 + i, { x: i }); a.meta.set(1000 + i, { clock: 0, lastUpdated: 0 }); }
    expect(trimAwareness(a as never)).toBe(true);
    expect(a.getStates().size).toBe(64);
    expect(a.getStates().has(a.clientID)).toBe(true);
    expect(trimAwareness(a as never)).toBe(false);
    // `meta` zostaje — powtórka tych samych stanów z tym samym zegarem nie wraca.
    expect(a.meta.has(1079)).toBe(true);
    a.destroy();
  });
});
