import * as Y from "yjs";
import { byName, cleanClient, cleanClientField, CLIENT_FIELDS, CLIENTS_MAX, type Client, type ClientField } from "./model";

/**
 * Kartoteka klientów w Y.Doc notatek — synchronizacja, plik i kopia jak reszta danych. Mapa `clients` (jeden płaski
 * zbiór kluczy, jak `studyJobs`): `c␁id` moment założenia (klient istnieje, gdy ten klucz jest), `f␁id␁pole` wartość
 * jednego pola, `s␁budowa` id klienta przypisanego do budowy. Każde pole ma własny klucz, więc telefon wpisany na
 * jednym urządzeniu i adres na drugim scalają się bez strat; to samo pole edytowane równocześnie wygrywa w całości.
 * Pola klienta zapisane po jego usunięciu (z drugiego urządzenia) zostają bez klucza `c` i nie robią z niego klienta.
 */

export const CLIENTS_ORIGIN = "clients";
const SEP = "\u0001";
const key = (...parts: string[]) => parts.join(SEP);
const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 64;
const FIELDS: ReadonlySet<string> = new Set(CLIENT_FIELDS);

export interface ClientsDump {
  clients: Client[];
  /** id budowy → id klienta. */
  sites: Record<string, string>;
}

export function createYClients(doc: Y.Doc) {
  const map = doc.getMap<unknown>("clients");
  let snapshot: { list: Client[]; byId: Map<string, Client>; links: Map<string, string> } | null = null;
  const listeners = new Set<() => void>();
  map.observe(() => {
    snapshot = null;
    listeners.forEach((l) => l());
  });

  function build() {
    if (snapshot) return snapshot;
    const created = new Map<string, number>();
    const raw = new Map<string, Record<string, unknown>>();
    const rawLinks = new Map<string, string>();
    for (const [k, v] of map.entries()) {
      const [kind, a, b] = k.split(SEP);
      if (!a || !isId(a)) continue;
      if (kind === "c") { if (typeof v === "number") created.set(a, v); }
      else if (kind === "f" && b && FIELDS.has(b)) { const o = raw.get(a) ?? {}; o[b] = v; raw.set(a, o); }
      else if (kind === "s" && isId(v)) rawLinks.set(a, v);
    }
    const list: Client[] = [];
    const byId = new Map<string, Client>();
    for (const [id, at] of created) {
      const c = cleanClient({ ...raw.get(id), id, created: at });
      if (c) { list.push(c); byId.set(id, c); }
    }
    list.sort(byName);
    // Powiązanie z klientem, którego już nie ma, nie istnieje (budowa wraca do „bez klienta”).
    const links = new Map<string, string>();
    for (const [site, id] of rawLinks) if (byId.has(id)) links.set(site, id);
    snapshot = { list, byId, links };
    return snapshot;
  }

  /** Lista klientów: aktywni po nazwie, potem archiwalni. Ta sama tablica do następnej zmiany. */
  const all = (): Client[] => build().list;
  const get = (id: string): Client | undefined => build().byId.get(id);
  /** Budowa → klient (tylko istniejący). */
  const links = (): ReadonlyMap<string, string> => build().links;
  const clientOfSite = (siteId: string): Client | undefined => { const s = build(); const id = s.links.get(siteId); return id ? s.byId.get(id) : undefined; };

  function subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }

  function writeFields(c: Client): void {
    for (const f of CLIENT_FIELDS) {
      const v = c[f];
      if (v === undefined) continue;
      map.set(key("f", c.id, f), v);
    }
  }

  /** Nowy klient; `false` = złe dane, istniejące id albo pełna kartoteka. */
  function add(input: Client): boolean {
    const c = cleanClient(input);
    if (!c || map.has(key("c", c.id)) || build().list.length >= CLIENTS_MAX) return false;
    doc.transact(() => { map.set(key("c", c.id), c.created); writeFields(c); }, CLIENTS_ORIGIN);
    return true;
  }

  /** Zmiana jednego pola. `false` = klienta nie ma albo wartość odrzucona (np. zły NIP, pusta nazwa). */
  function setField(id: string, field: ClientField, value: unknown): boolean {
    if (!isId(id) || !map.has(key("c", id))) return false;
    const v = cleanClientField(field, value);
    if (v === undefined) return false;
    doc.transact(() => map.set(key("f", id, field), v), CLIENTS_ORIGIN);
    return true;
  }

  /** Usuwa klienta i jego powiązania z budowami; zwraca je do „Cofnij”. */
  function remove(id: string): { client: Client; siteIds: string[] } | null {
    const client = get(id);
    if (!client) return null;
    const siteIds = [...build().links].filter(([, c]) => c === id).map(([s]) => s);
    doc.transact(() => {
      map.delete(key("c", id));
      for (const f of CLIENT_FIELDS) map.delete(key("f", id, f));
      for (const [k, v] of [...map.entries()]) if (k.startsWith(`s${SEP}`) && v === id) map.delete(k);
    }, CLIENTS_ORIGIN);
    return { client, siteIds };
  }

  /** Cofnięcie usunięcia: ten sam klient (id, data założenia) i jego budowy. */
  function restore(client: Client, siteIds: readonly string[]): boolean {
    const c = cleanClient(client);
    if (!c) return false;
    doc.transact(() => {
      map.set(key("c", c.id), c.created);
      writeFields(c);
      for (const s of siteIds) if (isId(s)) map.set(key("s", s), c.id);
    }, CLIENTS_ORIGIN);
    return true;
  }

  /** Przypisuje budowę do klienta; `false` = klienta nie ma. */
  function linkSite(siteId: string, clientId: string): boolean {
    if (!isId(siteId) || !map.has(key("c", clientId))) return false;
    doc.transact(() => map.set(key("s", siteId), clientId), CLIENTS_ORIGIN);
    return true;
  }

  function unlinkSite(siteId: string): void {
    if (map.has(key("s", siteId))) doc.transact(() => map.delete(key("s", siteId)), CLIENTS_ORIGIN);
  }

  function dump(): ClientsDump {
    return { clients: all(), sites: Object.fromEntries(links()) };
  }

  /**
   * Scala kopię: dodaje klientów i powiązania, których tu nie ma (po id), w limicie. Niczego nie kasuje
   * i nie nadpisuje klienta ani powiązania, które już są na tym telefonie.
   */
  function mergeDump(raw: unknown): void {
    const d = raw as Partial<ClientsDump> | null;
    if (!d || typeof d !== "object") return;
    const incoming = Array.isArray(d.clients) ? d.clients.slice(0, CLIENTS_MAX).map(cleanClient).filter((c): c is Client => !!c) : [];
    const linkEntries = d.sites && typeof d.sites === "object" ? Object.entries(d.sites).slice(0, 5000) : [];
    doc.transact(() => {
      let count = build().list.length;
      for (const c of incoming) {
        if (map.has(key("c", c.id)) || count >= CLIENTS_MAX) continue;
        map.set(key("c", c.id), c.created);
        writeFields(c);
        count++;
      }
      for (const [site, id] of linkEntries) {
        if (isId(site) && isId(id) && map.has(key("c", id)) && !map.has(key("s", site))) map.set(key("s", site), id);
      }
    }, CLIENTS_ORIGIN);
  }

  return { all, get, links, clientOfSite, subscribe, add, setField, remove, restore, linkSite, unlinkSite, dump, mergeDump };
}
