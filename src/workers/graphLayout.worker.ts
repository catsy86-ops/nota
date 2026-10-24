import { serveRpc, workerScopeTransport, type WorkerScope } from "@/workers/rpc";
import { graphLayoutHandlers } from "@/workers/graphLayoutHandlers";

// Worker układu grafu (plan rozbudowy, Faza 3.5): siłowy układ liczony poza wątkiem UI.
serveRpc(graphLayoutHandlers, workerScopeTransport(self as unknown as WorkerScope));
