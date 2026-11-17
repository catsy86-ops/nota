import * as Y from "yjs";

/** Pochodzenie transakcji z innej karty — nie odsyłamy jej z powrotem. */
export const TAB_SYNC_ORIGIN = "tab-sync";

/** `g` — pokolenie dokumentu nadawcy (Z-16.1B); wiadomość z innego pokolenia jest pomijana. */
type Message = ({ type: "update"; update: Uint8Array } | { type: "sv"; sv: Uint8Array }) & { g?: string };

/**
 * Synchronizacja dokumentu między kartami tej samej przeglądarki bez P2P.
 * IndexedDB jest wspólna, ale y-indexeddb nie powiadamia innych kart — bez tego
 * zmiana w jednej karcie była widoczna w drugiej dopiero po odświeżeniu.
 * Każda zmiana idzie przez `BroadcastChannel`; nowa karta prosi pozostałe o to,
 * czego nie ma (wektor stanu → brakujące aktualizacje). Zmiany, dla których
 * `isStoredOrigin` zwraca true (wczytane z IndexedDB), nie są rozsyłane — inne
 * karty mają je w tej samej bazie.
 *
 * `generation` — pokolenie dokumentu (zmienia je wymiana całego dokumentu, Z-16.1B). Karta sprzed wymiany ma inne
 * pokolenie: bez tego odpowiedziałaby nowej karcie na wektor stanu pełnym stanem sprzed wymiany i cofnęła ją.
 */
export function startTabSync(doc: Y.Doc, name: string, ready: Promise<unknown> = Promise.resolve(), isStoredOrigin: (origin: unknown) => boolean = () => false, generation = "0"): () => void {
  if (typeof BroadcastChannel === "undefined") return () => {};
  const channel = new BroadcastChannel(`kaczy-tabs:${name}`);
  let closed = false;
  const post = (m: Message) => { if (!closed) channel.postMessage({ ...m, g: generation }); };

  const onUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === TAB_SYNC_ORIGIN || isStoredOrigin(origin)) return;
    post({ type: "update", update });
  };
  doc.on("update", onUpdate);

  channel.onmessage = (e: MessageEvent<Message>) => {
    const m = e.data;
    if ((m?.g ?? "0") !== generation) return;
    if (m?.type === "update") Y.applyUpdate(doc, new Uint8Array(m.update), TAB_SYNC_ORIGIN);
    else if (m?.type === "sv") post({ type: "update", update: Y.encodeStateAsUpdate(doc, new Uint8Array(m.sv)) });
  };

  // Po wczytaniu z IndexedDB: inne karty dosyłają to, czego ta jeszcze nie zapisała.
  void ready.then(() => post({ type: "sv", sv: Y.encodeStateVector(doc) }));

  return () => {
    closed = true;
    doc.off("update", onUpdate);
    channel.close();
  };
}
