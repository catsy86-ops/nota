import { CLIENT_NOTE_MAX, type Client, type ClientField } from "./model";
import { getClient, linkSiteToClient, removeClient, restoreClient, setClientField } from "./store";

/**
 * Scalanie duplikatów (plan wycen i klientów, 2.6): klient `drop` znika, jego budowy przechodzą do klienta `keep`,
 * a puste pola `keep` są uzupełniane z `drop`. Nic nie ginie po cichu: różna notatka jest doklejana, a całość da się
 * cofnąć (`undo` przywraca `keep` do stanu sprzed scalenia i klienta `drop` z jego budowami).
 */

type Patch = Partial<Record<Exclude<ClientField, "archived" | "kind" | "name">, string>>;

/** Pola do zapisu w `keep`: tylko te, które się zmieniają. Adres bierzemy w całości (oba wiersze), gdy `keep` nie ma żadnego. */
export function mergePatch(keep: Client, drop: Client): Patch {
  const patch: Patch = {};
  if (!keep.phone && drop.phone) patch.phone = drop.phone;
  if (!keep.email && drop.email) patch.email = drop.email;
  if (!keep.nip && drop.nip) patch.nip = drop.nip;
  if (!keep.address1 && !keep.address2 && (drop.address1 || drop.address2)) {
    patch.address1 = drop.address1;
    patch.address2 = drop.address2;
  }
  if (drop.note && drop.note !== keep.note) {
    const joined = keep.note ? `${keep.note} · ${drop.note}` : drop.note;
    patch.note = joined.slice(0, CLIENT_NOTE_MAX);
  }
  return patch;
}

export interface MergeResult {
  /** Budowy przeniesione do `keep`. */
  moved: number;
  /** Pola uzupełnione w `keep`. */
  filled: number;
  undo: () => void;
}

/** `null` = brak któregoś klienta albo ten sam klient dwa razy. */
export function mergeClients(keepId: string, dropId: string): MergeResult | null {
  const keep = getClient(keepId);
  const drop = getClient(dropId);
  if (!keep || !drop || keepId === dropId) return null;
  const patch = mergePatch(keep, drop);
  const removed = removeClient(dropId);
  if (!removed) return null;
  for (const [field, value] of Object.entries(patch) as [keyof Patch, string][]) setClientField(keepId, field, value);
  for (const siteId of removed.siteIds) linkSiteToClient(siteId, keepId);
  return {
    moved: removed.siteIds.length,
    filled: Object.keys(patch).length,
    undo: () => {
      // `restoreClient` przepina budowy z powrotem na `drop`; `keep` wraca do pól sprzed scalenia.
      restoreClient(removed.client, removed.siteIds);
      for (const field of Object.keys(patch) as (keyof Patch)[]) setClientField(keepId, field, keep[field]);
    },
  };
}
