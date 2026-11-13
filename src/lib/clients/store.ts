import { useCallback, useSyncExternalStore } from "react";
import { yjsStore } from "@/lib/yjsStore";
import { cleanClient, type Client, type ClientField } from "./model";
import { createYClients } from "./yClients";

/** Kartoteka klientów żyje w dokumencie Yjs notatek (`yClients.ts`); widoki zmieniają ją tylko akcjami poniżej. */
const yClients = createYClients(yjsStore.doc);

export const useClients = (): Client[] => useSyncExternalStore(yClients.subscribe, yClients.all);
export const getClients = (): Client[] => yClients.all();
export const getClientLinks = (): ReadonlyMap<string, string> => yClients.links();
export const getClient = (id: string): Client | undefined => yClients.get(id);

/** Klient budowy; `undefined` = budowa bez klienta w kartotece. */
export function useSiteClient(siteId: string): Client | undefined {
  const get = useCallback(() => yClients.clientOfSite(siteId), [siteId]);
  return useSyncExternalStore(yClients.subscribe, get);
}

/** Budowa → id klienta (do listy budów i historii klienta). */
export const useClientLinks = (): ReadonlyMap<string, string> => useSyncExternalStore(yClients.subscribe, yClients.links);

export type NewClientInput = Partial<Omit<Client, "id" | "created" | "archived">> & { name: string };

/** Nowy klient; `null` = zła nazwa albo pełna kartoteka. Zły NIP i e-mail zostają puste — UI sprawdza je wcześniej. */
export function addClient(input: NewClientInput, now = Date.now()): Client | null {
  const c = cleanClient({ kind: "person", nip: "", address1: "", address2: "", phone: "", email: "", note: "", ...input, id: `cl-${crypto.randomUUID()}`, created: now });
  return c && yClients.add(c) ? c : null;
}

export const setClientField = (id: string, field: ClientField, value: unknown) => yClients.setField(id, field, value);
export const archiveClient = (id: string, on: boolean, now = Date.now()) => yClients.setField(id, "archived", on ? now : 0);
export const removeClient = (id: string) => yClients.remove(id);
export const restoreClient = (client: Client, siteIds: readonly string[]) => yClients.restore(client, siteIds);
export const linkSiteToClient = (siteId: string, clientId: string) => yClients.linkSite(siteId, clientId);
export const unlinkSiteFromClient = (siteId: string) => yClients.unlinkSite(siteId);

export const clientsDump = () => yClients.dump();
export const mergeClientsDump = (raw: unknown) => yClients.mergeDump(raw);
