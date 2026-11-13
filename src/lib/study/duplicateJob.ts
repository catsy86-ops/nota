import { getClientLinks, linkSiteToClient } from "@/lib/clients/store";
import type { Job, QuoteItem } from "./jobs";
import { saveQuoteItem, setJobMeta, setQuoteDoc } from "./jobsStore";
import { freeSiteName, siteKey, type SiteInfo } from "./sites";
import { saveSiteCard } from "./store";

/**
 * „Duplikuj wycenę” (plan wycen i klientów, 4.5): nowe zlecenie z kopią pozycji, zakresu, marży, rabatu, VAT i uwag. Kopia
 * dostaje kartę budowy z danymi klienta i to samo powiązanie z kartoteką, ale nie dziedziczy numeru, dat, stanu wysyłki,
 * terminu ani podpisu — to nowa wycena do nowego numeru. Nazwa „… (kopia)”, a gdy zajęta, „… (kopia 2)” itd.
 */

/** Pierwsza wolna nazwa „<nazwa> (kopia)”, „<nazwa> (kopia 2)”…; mieści się w limicie nazwy budowy. */
export const copyName = (name: string, taken: readonly Pick<SiteInfo, "name" | "id">[]): string =>
  freeSiteName(name, (i) => (i === 1 ? " (kopia)" : ` (kopia ${i})`), taken as readonly SiteInfo[]);

/** Nowe zlecenie z wyceny; zwraca id i nazwę kopii albo `null`, gdy karty nie udało się zapisać. */
export function duplicateJob(site: SiteInfo, job: Job, dir: readonly SiteInfo[], newId: () => string, now: number = Date.now()): { id: string; name: string } | null {
  const name = copyName(site.name, dir);
  const id = siteKey(name);
  if (dir.some((s) => s.id === id)) return null;
  if (!saveSiteCard(id, { name, address: site.address, investor: site.investor, ...(site.phone ? { phone: site.phone } : {}) }, now)) return null;
  setJobMeta(id, { status: "quote", ...(job.scope ? { scope: job.scope } : {}), ...(job.margin !== undefined ? { margin: job.margin } : {}) });
  const items: QuoteItem[] = [...job.items].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  items.forEach((i, order) => saveQuoteItem(id, { ...i, id: newId(), order }));
  const d = job.doc;
  const patch = {
    ...(d?.discount !== undefined ? { discount: d.discount } : {}),
    ...(d?.vatMode ? { vatMode: d.vatMode, vatRate: d.vatRate } : {}),
    ...(d?.notes ? { notes: d.notes } : {}),
  };
  if (Object.keys(patch).length > 0) setQuoteDoc(id, patch);
  const clientId = getClientLinks().get(site.id);
  if (clientId) linkSiteToClient(id, clientId);
  return { id, name };
}
