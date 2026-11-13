import { clientAddress, type Client } from "@/lib/clients/model";
import { linkSiteToClient } from "@/lib/clients/store";
import { setJobMeta } from "./jobsStore";
import { freeSiteName, siteKey, type SiteInfo } from "./sites";
import { saveSiteCard } from "./store";

/**
 * „Nowa wycena” z karty klienta (plan wycen i klientów, 4.6, decyzja WK-6): jednym przyciskiem powstaje zlecenie w stanie
 * „Wycena” — karta budowy w tle, z danymi klienta i połączona z nim w kartotece. Nazwa „<klient> — wycena”, a gdy zajęta,
 * „<klient> — wycena (2)” itd. Pozycje i zakres użytkownik dopisuje już na karcie zlecenia.
 */

/** Pierwsza wolna nazwa zlecenia dla klienta; mieści się w limicie nazwy budowy. */
export const quoteSiteName = (clientName: string, taken: readonly SiteInfo[]): string =>
  freeSiteName(clientName, (i) => (i === 1 ? " — wycena" : ` — wycena (${i})`), taken);

/** Zakłada zlecenie dla klienta; zwraca id i nazwę albo `null`, gdy karty nie udało się zapisać. */
export function newQuoteForClient(client: Client, dir: readonly SiteInfo[]): { id: string; name: string } | null {
  const name = quoteSiteName(client.name, dir);
  const id = siteKey(name);
  if (dir.some((s) => s.id === id)) return null;
  if (!saveSiteCard(id, { name, address: clientAddress(client), investor: client.name, ...(client.phone ? { phone: client.phone } : {}) })) return null;
  setJobMeta(id, { status: "quote" });
  linkSiteToClient(id, client.id);
  return { id, name };
}
