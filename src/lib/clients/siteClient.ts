import { toast } from "sonner";
import { foldName } from "@/lib/study/siteKey";
import { normalizeNip } from "@/lib/ksef/nip";
import { safeLine } from "@/lib/safeText";
import { clientAddress, cleanClientField, foldedName, parseClientNip, type Client } from "./model";
import { addClient, getClient, getClients, linkSiteToClient, setClientField, unlinkSiteFromClient } from "./store";

/**
 * Klient budowy (plan wycen i klientów, 2.1). Pole „Inwestor” na karcie budowy i w „Nowym zleceniu” zostaje tekstem
 * (zasada 2 planu: starsza wersja go czyta), a kartoteka dokłada powiązanie budowa → klient: nazwa zgodna z klientem
 * (po złożeniu: bez ogonków i wielkości liter) łączy budowę z nim, inna nazwa zdejmuje powiązanie.
 */

/** Aktywny klient o tej nazwie; archiwalnego pomija, chyba że tylko taki jest. */
export function findClientByName(clients: readonly Client[], name: string): Client | undefined {
  const key = foldName(name);
  if (!key) return undefined;
  const same = clients.filter((c) => foldedName(c) === key);
  return same.find((c) => !c.archived) ?? same[0];
}

export type SiteClientStatus =
  /** Budowa jest połączona z klientem o tej nazwie. */
  | { kind: "linked"; client: Client }
  /** Pusty inwestor: budowa bez klienta. */
  | { kind: "none" }
  /** Nazwa nie pasuje do nikogo z kartoteki: można zaproponować założenie klienta. */
  | { kind: "unmatched" };

/**
 * Po zapisie karty: dopasowuje powiązanie budowy do wpisanego inwestora. Niczego nie zakłada samo. Brak dopasowania zdejmuje
 * powiązanie tylko wtedy, gdy inwestor został zmieniony (`unlinkIfUnmatched`) — inaczej zmiana nazwy klienta w kartotece
 * rozłączałaby budowę po cichu przy najbliższym zapisie innego pola karty.
 */
export function syncSiteClient(siteId: string, investor: string, unlinkIfUnmatched = true): SiteClientStatus {
  const match = findClientByName(getClients(), investor);
  if (match) {
    linkSiteToClient(siteId, match.id);
    return { kind: "linked", client: match };
  }
  if (unlinkIfUnmatched) unlinkSiteFromClient(siteId);
  return foldName(investor) ? { kind: "unmatched" } : { kind: "none" };
}

/** „Dodaj do klientów” z propozycji po zapisie karty: zakłada klienta z danych karty i łączy z budową. */
export function createClientForSite(siteId: string, card: { investor: string; phone?: string; address?: string }): Client | null {
  return addAndLink(siteId, { name: card.investor, phone: card.phone ?? "", address1: card.address ?? "" });
}

/** Zakłada klienta i od razu łączy go z budową; `null`, gdy kartoteka odrzuciła dane. */
function addAndLink(siteId: string, input: Parameters<typeof addClient>[0]): Client | null {
  const c = addClient(input);
  if (c) linkSiteToClient(siteId, c.id);
  return c;
}

/**
 * Po zapisie karty: łączy budowę z klientem. `changed` = inwestor został zmieniony w tym zapisie; tylko wtedy brak dopasowania
 * zdejmuje powiązanie, a gdy dodatkowo `ask` (domyślnie tak samo jak `changed`), pyta w dymku „Dodać do klientów?” —
 * zwykły zapis karty nie przypomina o tym za każdym razem.
 */
export function proposeClient(siteId: string, card: { investor: string; phone?: string; address?: string }, changed = true, ask = changed): SiteClientStatus {
  const investor = card.investor.trim();
  const status = syncSiteClient(siteId, investor, changed);
  if (status.kind === "unmatched" && ask) {
    toast(`Dodać „${investor}” do klientów?`, {
      action: {
        label: "Dodaj",
        onClick: () => { if (!createClientForSite(siteId, { ...card, investor })) toast.error("Nie udało się dodać klienta", { description: "Kartoteka jest pełna albo nazwa jest nieprawidłowa." }); },
      },
    });
  }
  return status;
}

/** Dane do uzupełnienia pól karty po wyborze klienta z podpowiedzi: tylko to, co w karcie jest jeszcze puste. */
export function fillFromClient(client: Client, current: { phone: string; address: string }): { phone: string; address: string } {
  return {
    phone: current.phone.trim() ? current.phone : client.phone,
    address: current.address.trim() ? current.address : clientAddress(client),
  };
}

/** Nabywca faktury z danych klienta (2.2). */
export interface BuyerParty { name: string; nip: string; address1: string; address2: string }
export const buyerFromClient = (c: Client): BuyerParty => ({ name: c.name, nip: c.nip, address1: c.address1, address2: c.address2 });

/** Czy nabywca w oknie faktury różni się od danych klienta (porównanie tak, jak zapisuje kartoteka: `safeLine`, NIP bez kresek). */
export function buyerDiffers(buyer: BuyerParty, c: Client): boolean {
  return safeLine(buyer.name) !== c.name || normalizeNip(buyer.nip.trim()) !== c.nip || safeLine(buyer.address1) !== c.address1 || safeLine(buyer.address2) !== c.address2;
}

/**
 * „Zapisać u klienta?” z okna faktury: przepisuje nazwę, NIP i adres nabywcy do kartoteki. Nic nie zapisuje, gdy któreś
 * pole jest nieprawidłowe (np. zły NIP) — zwraca pole z błędem, żeby okno mogło o nim powiedzieć.
 */
export function saveBuyerToClient(clientId: string, buyer: BuyerParty): { ok: true } | { ok: false; field: "name" | "nip" | "address" } {
  if (!getClient(clientId)) return { ok: false, field: "name" };
  const fields = [["name", buyer.name], ["nip", buyer.nip], ["address1", buyer.address1], ["address2", buyer.address2]] as const;
  const bad = fields.find(([field, value]) => cleanClientField(field, value) === undefined);
  if (bad) return { ok: false, field: bad[0] === "name" || bad[0] === "nip" ? bad[0] : "address" };
  for (const [field, value] of fields) setClientField(clientId, field, value);
  return { ok: true };
}

/** „Dodaj do klientów” z okna faktury: nowy klient z danymi nabywcy (firma, gdy jest NIP), połączony z budową. */
export function createClientFromBuyer(siteId: string, buyer: BuyerParty): Client | null {
  const nip = parseClientNip(buyer.nip);
  if (nip === undefined) return null;
  return addAndLink(siteId, { name: buyer.name, kind: nip ? "company" : "person", nip, address1: buyer.address1, address2: buyer.address2 });
}
