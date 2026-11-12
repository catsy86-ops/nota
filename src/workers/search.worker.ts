import { serveRpc, workerScopeTransport, type WorkerScope } from "@/workers/rpc";
import { workSearchHandlers } from "@/workers/workSearchHandlers";
import { noteSearchHandlers } from "@/workers/noteSearchHandlers";

// Jeden Worker wyszukiwania: indeks notatek (plan 3.2) i indeks wpisów Pracy (B5.6). Wspólny plik, żeby MiniSearch
// był w paczce raz; każda strona otwiera własną instancję, a metody mają rozłączne nazwy (`noteSync`/`noteSearch`
// kontra `build`/`search`).
serveRpc({ ...workSearchHandlers, ...noteSearchHandlers }, workerScopeTransport(self as unknown as WorkerScope));
