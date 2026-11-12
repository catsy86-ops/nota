import type MiniSearch from "minisearch";
import { createRpcClient, workerTransport, type RpcClient } from "@/workers/rpc";
import { makeIndex, searchKeys, type IndexDoc } from "@/lib/study/workSearchCore";
import type { WorkSearchHandlers } from "@/workers/workSearchHandlers";

let client: RpcClient<WorkSearchHandlers> | null = null;

function getClient(): RpcClient<WorkSearchHandlers> {
  client ??= createRpcClient<WorkSearchHandlers>(
    () => workerTransport(new Worker(new URL("./search.worker.ts", import.meta.url), { type: "module" })),
    // Bezczynny Worker zwalniamy (indeks znika z pamięci); następne zapytanie zbuduje go od nowa.
    { idleMs: 60_000 },
  );
  return client;
}

// Indeks jest budowany raz na zestaw dokumentów (tożsamość tablicy), nie przy każdym znaku zapytania.
let builtFor: readonly IndexDoc[] | null = null;
let building: Promise<unknown> = Promise.resolve();

let engine: Promise<typeof MiniSearch> | null = null;
const loadEngine = () => (engine ??= import("minisearch").then((m) => m.default));
let mainFor: readonly IndexDoc[] | null = null;
let mainIndex: MiniSearch<IndexDoc> | null = null;

/** Ścieżka awaryjna (bez Workerów, np. jsdom, albo gdy Worker zawiedzie): ten sam indeks w głównym wątku. */
async function searchOnMain(docs: readonly IndexDoc[], query: string, limit: number): Promise<string[]> {
  const Engine = await loadEngine();
  if (mainFor !== docs || !mainIndex) { mainIndex = makeIndex(Engine, docs); mainFor = docs; }
  return searchKeys(mainIndex, query, limit);
}

/**
 * Klucze trafień dla zapytania nad zestawem dokumentów. Indeks buduje i przeszukuje Worker (budowa to rzędu 200 ms
 * głównego wątku na telefonie przy tysiącach wpisów); bez Workera albo przy jego błędzie liczy w wątku.
 */
export async function searchWorkKeys(docs: readonly IndexDoc[], query: string, limit: number): Promise<string[]> {
  if (typeof Worker === "undefined") return searchOnMain(docs, query, limit);
  try {
    const c = getClient();
    if (builtFor !== docs) {
      builtFor = docs;
      building = c.call("build", docs as IndexDoc[]);
    }
    await building;
    return await c.call("search", query, limit);
  } catch {
    builtFor = null; // następna próba zbuduje indeks od nowa
    return searchOnMain(docs, query, limit);
  }
}
