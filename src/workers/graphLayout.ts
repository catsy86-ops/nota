import { forceLayout, type GraphEdge, type GraphNode, type Point } from "@/lib/noteGraph";
import { createRpcClient, workerTransport, type RpcClient } from "@/workers/rpc";
import type { GraphLayoutHandlers } from "@/workers/graphLayoutHandlers";

let client: RpcClient<GraphLayoutHandlers> | null = null;

function getClient(): RpcClient<GraphLayoutHandlers> {
  client ??= createRpcClient<GraphLayoutHandlers>(
    () => workerTransport(new Worker(new URL("./graphLayout.worker.ts", import.meta.url), { type: "module" })),
    // Bezczynny Worker zwalniamy po chwili; następny układ otworzy go od nowa.
    { idleMs: 30_000 },
  );
  return client;
}

/**
 * Układ siłowy w Workerze. Bez Workerów (testy jsdom) albo gdy Worker się nie uruchomi,
 * liczy w wątku — wynik jest ten sam, tylko UI chwilę dłużej czeka.
 */
export async function layoutGraph(nodes: GraphNode[], edges: GraphEdge[], w: number, h: number): Promise<Map<string, Point>> {
  if (typeof Worker === "undefined") return forceLayout(nodes, edges, w, h);
  try {
    return new Map(await getClient().call("layout", nodes, edges, w, h));
  } catch {
    return forceLayout(nodes, edges, w, h);
  }
}
