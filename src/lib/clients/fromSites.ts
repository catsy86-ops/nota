import { safeLine } from "@/lib/safeText";
import { foldName } from "@/lib/study/siteKey";
import type { SiteCard } from "@/lib/study/sites";
import { byName, foldedName, type Client } from "./model";
import { addClient, linkSiteToClient } from "./store";

/**
 * Jednorazowa propozycja z istniejących budów (plan wycen i klientów, 1.6): inwestorzy z kart budów, którzy nie mają
 * jeszcze klienta w kartotece. Ta sama nazwa (po złożeniu: bez ogonków, wielkości liter i podwójnych spacji) to jeden
 * klient. Nic nie dzieje się samo — `applyProposals` woła dopiero „Utwórz” w oknie propozycji.
 */

export interface ClientProposal {
  /** Złożona nazwa — stabilny klucz propozycji. */
  key: string;
  name: string;
  phone: string;
  address: string;
  siteIds: string[];
  /** Klient o tej nazwie już jest: propozycja tylko podłącza do niego budowy. */
  existingId?: string;
}

type SiteLike = Pick<SiteCard, "id" | "investor" | "phone" | "address" | "created">;

export function proposeClients(sites: readonly SiteLike[], clients: readonly Client[], links: ReadonlyMap<string, string>): ClientProposal[] {
  const groups = new Map<string, SiteLike[]>();
  for (const s of sites) {
    const key = foldName(s.investor);
    if (!key || links.has(s.id)) continue;
    const list = groups.get(key) ?? [];
    list.push(s);
    groups.set(key, list);
  }
  // Klient o danej nazwie (pierwszy po `byName`): indeks raz, zamiast filtra po całej kartotece dla każdej grupy.
  const byFolded = new Map<string, Client>();
  for (const c of [...clients].sort(byName)) if (!byFolded.has(foldedName(c))) byFolded.set(foldedName(c), c);
  const out: ClientProposal[] = [];
  for (const [key, list] of groups) {
    const newest = [...list].sort((a, b) => b.created - a.created || a.id.localeCompare(b.id));
    // Pisownia: najczęstsza w kartach, a przy remisie z najnowszej.
    const spellings = new Map<string, number>();
    for (const s of newest) { const n = safeLine(s.investor); spellings.set(n, (spellings.get(n) ?? 0) + 1); }
    const name = [...spellings].sort((a, b) => b[1] - a[1])[0][0];
    const existing = byFolded.get(key);
    out.push({
      key,
      name,
      phone: newest.find((s) => s.phone)?.phone ?? "",
      address: newest.find((s) => s.address)?.address ?? "",
      siteIds: list.map((s) => s.id),
      ...(existing ? { existingId: existing.id } : {}),
    });
  }
  return out.sort((a, b) => foldName(a.name).localeCompare(foldName(b.name)) || a.key.localeCompare(b.key));
}

export interface ApplyResult {
  created: number;
  linked: number;
  /** Propozycje, których nie udało się zapisać (pełna kartoteka, nieprawidłowa nazwa). */
  failed: number;
}

/** Zakłada klientów z propozycji (albo podłącza do istniejących) i przypisuje im budowy. */
export function applyProposals(proposals: readonly ClientProposal[]): ApplyResult {
  const result: ApplyResult = { created: 0, linked: 0, failed: 0 };
  for (const p of proposals) {
    let id = p.existingId;
    if (!id) {
      const c = addClient({ name: p.name, phone: p.phone, address1: p.address });
      if (!c) { result.failed++; continue; }
      id = c.id;
      result.created++;
    }
    for (const siteId of p.siteIds) if (linkSiteToClient(siteId, id)) result.linked++;
  }
  return result;
}
