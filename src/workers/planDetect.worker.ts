import { serveRpc, workerScopeTransport, type WorkerScope } from "@/workers/rpc";
import { planDetectHandlers } from "@/workers/planDetectHandlers";

// Worker propozycji tras (Analizator planów, faza 5): maska koloru i szkielet poza wątkiem UI.
serveRpc(planDetectHandlers, workerScopeTransport(self as unknown as WorkerScope));
