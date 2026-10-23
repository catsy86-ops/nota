import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRpcClient, serveRpc, type RpcTransport } from "./rpc";

/** Para połączonych kanałów w pamięci: to, co wyśle jedna strona, odbiera druga. */
function channelPair(): { client: RpcTransport; server: RpcTransport; closed: { count: number } } {
  const closed = { count: 0 };
  const make = (): { t: RpcTransport; listeners: Set<(m: unknown) => void>; peer: { listeners: Set<(m: unknown) => void> } } => {
    const listeners = new Set<(m: unknown) => void>();
    const peer = { listeners: new Set<(m: unknown) => void>() };
    const t: RpcTransport = {
      send: (m) => queueMicrotask(() => peer.listeners.forEach((l) => l(structuredClone(m)))),
      onMessage: (l) => {
        listeners.add(l);
        return () => listeners.delete(l);
      },
      close: () => {
        closed.count++;
      },
    };
    return { t, listeners, peer };
  };
  const a = make();
  const b = make();
  a.peer.listeners = b.listeners;
  b.peer.listeners = a.listeners;
  return { client: a.t, server: b.t, closed };
}

describe("rpc", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("zwraca wynik metody i przenosi błąd jako Error", async () => {
    const pair = channelPair();
    serveRpc(
      {
        add: (a: number, b: number) => a + b,
        boom: () => {
          throw new Error("zła dana");
        },
      },
      pair.server,
    );
    const client = createRpcClient<{ add: (a: number, b: number) => number; boom: () => never }>(() => pair.client);
    await expect(client.call("add", 2, 3)).resolves.toBe(5);
    await expect(client.call("boom")).rejects.toThrow("zła dana");
  });

  it("odrzuca nieznaną metodę zamiast zawisnąć", async () => {
    const pair = channelPair();
    serveRpc({}, pair.server);
    const client = createRpcClient<Record<string, () => unknown>>(() => pair.client);
    await expect(client.call("nope")).rejects.toThrow("Nieznana metoda: nope");
  });

  it("zamyka transport po bezczynności i otwiera go ponownie przy kolejnym wywołaniu", async () => {
    const pairs: ReturnType<typeof channelPair>[] = [];
    const open = vi.fn(() => {
      const p = channelPair();
      pairs.push(p);
      serveRpc({ ping: () => "pong" }, p.server);
      return p.client;
    });
    const client = createRpcClient<{ ping: () => string }>(open, { idleMs: 1000 });

    await expect(client.call("ping")).resolves.toBe("pong");
    expect(open).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);
    expect(pairs[0].closed.count).toBe(1);

    await expect(client.call("ping")).resolves.toBe("pong");
    expect(open).toHaveBeenCalledTimes(2);
    client.dispose();
  });

  it("nie zamyka transportu, gdy wywołanie jest w toku", async () => {
    const pair = channelPair();
    let release: (v: string) => void = () => {};
    serveRpc({ slow: () => new Promise<string>((r) => (release = r)) }, pair.server);
    const client = createRpcClient<{ slow: () => Promise<string> }>(() => pair.client, { idleMs: 50 });

    const p = client.call("slow");
    await vi.advanceTimersByTimeAsync(500);
    expect(pair.closed.count).toBe(0);
    release("gotowe");
    await expect(p).resolves.toBe("gotowe");
    client.dispose();
  });

  it("dispose odrzuca oczekujące wywołania", async () => {
    const pair = channelPair();
    serveRpc({ never: () => new Promise(() => {}) }, pair.server);
    const client = createRpcClient<{ never: () => Promise<void> }>(() => pair.client);
    const p = client.call("never");
    client.dispose();
    await expect(p).rejects.toThrow("Worker zamknięty");
    expect(pair.closed.count).toBe(1);
  });
});
