import { detectLines, type DetectedPolyline, type DetectOptions } from "@/lib/plans/detect/lines";
import { createRpcClient, workerTransport, type RpcClient } from "@/workers/rpc";
import type { PlanDetectHandlers } from "@/workers/planDetectHandlers";

let client: RpcClient<PlanDetectHandlers> | null = null;

function getClient(): RpcClient<PlanDetectHandlers> {
  client ??= createRpcClient<PlanDetectHandlers>(
    () => workerTransport(new Worker(new URL("./planDetect.worker.ts", import.meta.url), { type: "module" })),
    // Bezczynny Worker zwalniamy po chwili (pamięć telefonu); następne wykrywanie otworzy go od nowa.
    { idleMs: 20_000 },
  );
  return client;
}

/** Propozycje tras w Workerze; bez Workerów (jsdom) albo gdy się nie uruchomi — w wątku. */
export async function detectInWorker(rgba: Uint8ClampedArray, w: number, h: number, opts: DetectOptions): Promise<DetectedPolyline[]> {
  if (typeof Worker === "undefined") return detectLines(rgba, w, h, opts);
  try {
    return await getClient().call("detect", rgba, w, h, opts);
  } catch {
    return detectLines(rgba, w, h, opts);
  }
}
