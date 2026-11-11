import { serveRpc, workerScopeTransport, type WorkerScope } from "@/workers/rpc";
import { workSearchHandlers } from "@/workers/workSearchHandlers";

// Worker wyszukiwania w Pracy (plan Praca B5.6): indeks MiniSearch poza wątkiem UI.
serveRpc(workSearchHandlers, workerScopeTransport(self as unknown as WorkerScope));
