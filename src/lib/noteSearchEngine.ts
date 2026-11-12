import type { Note } from "@/hooks/useNotes";
import { createRpcClient, type RpcTransport } from "@/workers/rpc";
import type { NoteSearchHandlers } from "@/workers/noteSearchHandlers";
import { sameDoc, toDoc, type IndexDoc } from "@/lib/noteSearchCore";

/**
 * Strona wyszukiwania notatek w Workerze (plan 3.2). Indeks MiniSearch żyje w Workerze; tutaj tylko:
 * - przyrostowa synchronizacja: do Workera idą wyłącznie dokumenty, które zmieniły się od ostatniej wysyłki
 *   (zmieniona notatka to nowy obiekt, dokument liczymy raz na obiekt),
 * - pamięć podręczna wyników: zapytanie → uszeregowane id, ważna do następnej zmiany indeksu,
 * - powiadomienie (`subscribe`), gdy dojdzie odpowiedź — widoki przeliczają wtedy wyniki.
 *
 * `lookup` jest synchroniczne: zwraca trafienia z pamięci podręcznej albo `null` (zapytanie poszło do Workera,
 * wywołujący pokaże na ten czas dokładne trafienia). Worker zwalniany przy bezczynności wstaje z pustym indeksem —
 * poznajemy to po znaczniku życia w odpowiedzi i wysyłamy wszystko jeszcze raz.
 */
export interface NoteSearchEngine {
  lookup(source: Note[], free: string): Note[] | null;
  /** Rośnie przy każdej odpowiedzi Workera i zmianie indeksu; do zależności `useMemo`. */
  version(): number;
  subscribe(cb: () => void): () => void;
  /** `true` po błędzie Workera — wywołujący wraca do indeksu w głównym wątku. */
  failed(): boolean;
  dispose(): void;
}

const CACHE_MAX = 64;

export function createNoteSearchEngine(open: () => RpcTransport, { idleMs = 120_000 }: { idleMs?: number } = {}): NoteSearchEngine {
  const client = createRpcClient<NoteSearchHandlers>(open, { idleMs });
  const docCache = new WeakMap<Note, IndexDoc>();
  const byIdCache = new WeakMap<Note[], Map<string, Note>>();
  const syncedSources = new WeakSet<Note[]>();
  /** Co wysłaliśmy do Workera (id → dokument); do wyliczania różnic i do ponownej wysyłki całości. */
  const sent = new Map<string, IndexDoc>();
  const cache = new Map<string, string[]>();
  const pending = new Set<string>();
  const listeners = new Set<() => void>();
  let indexVersion = 0;
  let uiVersion = 0;
  let chain: Promise<unknown> = Promise.resolve();
  let knownEpoch: string | null = null;
  let broken = false;

  const bump = () => { uiVersion++; listeners.forEach((l) => l()); };
  const fail = () => { broken = true; bump(); };

  function docOf(n: Note): IndexDoc {
    let d = docCache.get(n);
    if (!d) { d = toDoc(n); docCache.set(n, d); }
    return d;
  }

  /** Worker wstał od nowa (inny znacznik): jego indeks jest pusty, więc idzie cała wysyłka. */
  async function noteEpoch(epoch: string): Promise<boolean> {
    if (knownEpoch === epoch) return false;
    const restarted = knownEpoch !== null;
    knownEpoch = epoch;
    if (restarted) await client.call("noteSync", [...sent.values()], []);
    return restarted;
  }

  /** Doprowadza Worker do stanu `source`; notatki zablokowane (prywatne) są z indeksu usuwane. */
  function syncSource(source: Note[]): void {
    if (syncedSources.has(source)) return;
    syncedSources.add(source);
    const upserts: IndexDoc[] = [];
    const removes: string[] = [];
    for (const n of source) {
      const prev = sent.get(n.id);
      if (n.locked) {
        if (prev) { removes.push(n.id); sent.delete(n.id); }
        continue;
      }
      const doc = docOf(n);
      if (prev === doc || (prev && sameDoc(prev, doc))) continue;
      upserts.push(doc);
      sent.set(n.id, doc);
    }
    if (upserts.length === 0 && removes.length === 0) return;
    indexVersion++;
    chain = chain.then(async () => { await noteEpoch((await client.call("noteSync", upserts, removes)).epoch); }).catch(fail);
  }

  function byIdOf(source: Note[]): Map<string, Note> {
    let m = byIdCache.get(source);
    if (!m) { m = new Map(source.map((n) => [n.id, n])); byIdCache.set(source, m); }
    return m;
  }

  async function run(free: string, key: string): Promise<void> {
    try {
      await chain;
      let r = await client.call("noteSearch", free);
      if (await noteEpoch(r.epoch)) r = await client.call("noteSearch", free);
      cache.set(key, r.ids);
      if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
    } catch {
      broken = true;
    } finally {
      pending.delete(key);
      bump();
    }
  }

  return {
    lookup(source, free) {
      if (broken) return null;
      syncSource(source);
      const key = `${indexVersion}\u0000${free}`;
      const ids = cache.get(key);
      if (ids) {
        const byId = byIdOf(source);
        return ids.map((id) => byId.get(id)).filter((n): n is Note => n !== undefined);
      }
      if (!pending.has(key)) { pending.add(key); void run(free, key); }
      return null;
    },
    version: () => uiVersion,
    subscribe(cb) { listeners.add(cb); return () => { listeners.delete(cb); }; },
    failed: () => broken,
    dispose() { client.dispose(); cache.clear(); pending.clear(); listeners.clear(); },
  };
}
