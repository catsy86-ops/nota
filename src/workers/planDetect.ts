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

/** Najdłużej liczy worker; potem jest zamykany (przegląd D1 — bez zawieszonego workera). */
const DETECT_TIMEOUT_MS = 30_000;
/** W wątku UI liczymy tylko małe obrazy (gdy Worker się nie uruchomi) — duże zamroziłyby aplikację. */
const MAIN_THREAD_PIXELS_MAX = 1_000_000;

/** Przerywa liczenie: zamyka worker (następne wywołanie otworzy nowy). */
export function cancelDetect(): void {
  client?.dispose();
  client = null;
}

/** Propozycje tras w Workerze; bez Workerów (jsdom) albo gdy się nie uruchomi — w wątku, ale tylko mały obraz. */
export async function detectInWorker(rgba: Uint8ClampedArray, w: number, h: number, opts: DetectOptions): Promise<DetectedPolyline[]> {
  if (typeof Worker === "undefined") return detectLines(rgba, w, h, opts);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      getClient().call("detect", rgba, w, h, opts),
      new Promise<never>((_, reject) => { timer = setTimeout(() => { cancelDetect(); reject(new Error("Wyszukiwanie trwało za długo — zmniejsz tolerancję.")); }, DETECT_TIMEOUT_MS); }),
    ]);
  } catch (e) {
    const msg = (e as Error).message ?? "";
    // Błąd z algorytmu albo limit czasu — przekazujemy dalej; nieudany start Workera — w wątku, jeśli obraz mały.
    if (/Za dużo linii|za długo|Przerwano/.test(msg) || w * h > MAIN_THREAD_PIXELS_MAX) throw e;
    return detectLines(rgba, w, h, opts);
  } finally {
    clearTimeout(timer);
  }
}
