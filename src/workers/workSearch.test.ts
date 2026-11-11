import { describe, expect, it } from "vitest";
import { createRpcClient, serveRpc, type RpcTransport } from "./rpc";
import { workSearchHandlers, type WorkSearchHandlers } from "./workSearchHandlers";
import { searchWorkKeys } from "./workSearch";
import type { IndexDoc } from "@/lib/study/workSearchCore";

// B5.6: wyszukiwanie w Pracy w Workerze. Worker jest sprawdzony przez prawdziwe RPC nad kanałem w pamięci (jsdom nie ma
// Workerów); ścieżka awaryjna (bez Workera) przez `searchWorkKeys`.

const docs: IndexDoc[] = [
  { key: "entry:1", text: "Wymieniony zawór kulowy w łazience", site: "Lipowa 5" },
  { key: "entry:2", text: "Zawór zwrotny przy liczniku", site: "Polna 2" },
  { key: "entry:3", text: "Pion kanalizacji", site: "Lipowa 5" },
];

function channelPair(): { client: RpcTransport; server: RpcTransport } {
  const toServer = new Set<(m: unknown) => void>();
  const toClient = new Set<(m: unknown) => void>();
  const make = (inbox: Set<(m: unknown) => void>, outbox: Set<(m: unknown) => void>): RpcTransport => ({
    send: (m) => queueMicrotask(() => outbox.forEach((l) => l(structuredClone(m)))),
    onMessage: (l) => { inbox.add(l); return () => inbox.delete(l); },
    close: () => undefined,
  });
  return { client: make(toClient, toServer), server: make(toServer, toClient) };
}

describe("workSearchHandlers przez RPC", () => {
  it("build i search: trafienia w kolejności trafności, bez polskich znaków i z literówką", async () => {
    const pair = channelPair();
    serveRpc(workSearchHandlers, pair.server);
    const c = createRpcClient<WorkSearchHandlers>(() => pair.client);
    expect(await c.call("search", "zawór", 8)).toEqual([]); // przed budową
    expect(await c.call("build", docs)).toBe(3);
    expect(await c.call("search", "zawór Lipowa", 8)).toEqual(["entry:1"]);
    expect(await c.call("search", "zawor", 8)).toEqual(expect.arrayContaining(["entry:1", "entry:2"]));
    expect(await c.call("search", "kanalizcji", 8)).toContain("entry:3");
    expect(await c.call("search", "zawor", 1)).toHaveLength(1);
    expect(await c.call("search", "   ", 8)).toEqual([]);
  });
});

describe("searchWorkKeys bez Workera (ścieżka awaryjna)", () => {
  it("zwraca te same klucze co Worker i przebudowuje indeks dla nowego zestawu dokumentów", async () => {
    expect(typeof Worker).toBe("undefined");
    expect(await searchWorkKeys(docs, "zawór Lipowa", 8)).toEqual(["entry:1"]);
    expect(await searchWorkKeys(docs, "kanalizcji", 8)).toContain("entry:3");
    const other: IndexDoc[] = [{ key: "doc:1", text: "Projekt instalacji", site: "Kowalski" }];
    expect(await searchWorkKeys(other, "projekt", 8)).toEqual(["doc:1"]);
    expect(await searchWorkKeys(other, "zawór", 8)).toEqual([]); // stary indeks nie przecieka
  });
});
