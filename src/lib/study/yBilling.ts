import * as Y from "yjs";
import { cleanAmount, cleanModes, cleanPayment, DEFAULT_MODES, PAYMENTS_MAX, sortPayments, type BillingMode, type Payment, type SiteBilling } from "./billing";

/**
 * Sposób rozliczenia budów w Y.Doc notatek (H3.1) — synchronizacja i kopia jak reszta danych. Mapa
 * `studyBilling`, każde pole pod własnym kluczem: `m␁budowa` sposoby, `d␁budowa` stawka za punkt,
 * `t␁budowa␁typ` stawka typu punktu, `l␁budowa` ryczałt, `s␁budowa␁etap` ryczałt etapu, `p␁budowa␁id` wpłata `{ day, amount, note? }` (H3.2). Dwa telefony
 * zmieniające różne stawki scalają się bez strat. Osobno od karty budowy, żeby pieniądze nie trafiły
 * do wspólnej budowy z pomocnikiem (zasada 4 planu); osobno od `yStudy.ts` (paczka startowa).
 */

export const BILLING_ORIGIN = "billing";
const SEP = "\u0001";
const key = (...parts: string[]) => parts.join(SEP);
const isId = (v: string) => v.length > 0 && v.length <= 64;

/** Zapisane pola budowy; `modes` brak = nie wybierano (domyślnie godziny). */
export type StoredBilling = Omit<SiteBilling, "modes"> & { modes?: BillingMode[] };

export interface BillingDump {
  sites: Record<string, StoredBilling>;
}

const empty = (): StoredBilling => ({ typeRates: {}, stageAmounts: {}, payments: [] });
const withDefaults = (s: StoredBilling | undefined): SiteBilling => ({ ...empty(), ...s, modes: [...(s?.modes ?? DEFAULT_MODES)] });

export function createYBilling(doc: Y.Doc) {
  const map = doc.getMap<unknown>("studyBilling");
  let snapshot: Map<string, StoredBilling> | null = null;
  const cache = new Map<string, SiteBilling>();
  const listeners = new Set<() => void>();
  map.observe(() => {
    snapshot = null;
    cache.clear();
    listeners.forEach((l) => l());
  });

  function all(): Map<string, StoredBilling> {
    if (snapshot) return snapshot;
    const out = new Map<string, StoredBilling>();
    const of = (site: string) => { let s = out.get(site); if (!s) { s = empty(); out.set(site, s); } return s; };
    for (const [k, v] of map.entries()) {
      const [kind, site, id] = k.split(SEP);
      if (!site || !isId(site)) continue;
      if (kind === "m") { const m = cleanModes(v); if (m) of(site).modes = m; continue; }
      if (kind === "p") { const pay = id && isId(id) ? cleanPayment(v, id) : null; if (pay) of(site).payments.push(pay); continue; }
      const n = cleanAmount(v);
      if (n === undefined) continue;
      if (kind === "d") of(site).pointRate = n;
      else if (kind === "l") of(site).lump = n;
      else if (kind === "t" && id && isId(id)) of(site).typeRates[id] = n;
      else if (kind === "s" && id && isId(id)) of(site).stageAmounts[id] = n;
    }
    for (const s of out.values()) sortPayments(s.payments);
    snapshot = out;
    return out;
  }

  /** Rozliczenie budowy z domyślnymi; ten sam obiekt do następnej zmiany (`useSyncExternalStore`). */
  function get(site: string): SiteBilling {
    let b = cache.get(site);
    if (!b) { b = withDefaults(all().get(site)); cache.set(site, b); }
    return b;
  }

  function subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }

  /** Kwota pod kluczem; `null` usuwa. Zła kwota — nic się nie zmienia, `false`. */
  function setAmount(k: string, amount: number | null): boolean {
    if (amount === null) {
      if (map.has(k)) doc.transact(() => map.delete(k), BILLING_ORIGIN);
      return true;
    }
    const n = cleanAmount(amount);
    if (n === undefined) return false;
    if (map.get(k) !== n) doc.transact(() => map.set(k, n), BILLING_ORIGIN);
    return true;
  }

  const setModes = (site: string, modes: readonly BillingMode[]) => {
    const m = cleanModes(modes) ?? [];
    doc.transact(() => map.set(key("m", site), m), BILLING_ORIGIN);
  };
  /** Stawka za punkt: `typeId` `null` = domyślna, inaczej stawka typu. */
  const setPointRate = (site: string, typeId: string | null, amount: number | null) =>
    typeId === null ? setAmount(key("d", site), amount) : isId(typeId) && setAmount(key("t", site, typeId), amount);
  const setLump = (site: string, amount: number | null) => setAmount(key("l", site), amount);
  const setStageAmount = (site: string, stageId: string, amount: number | null) => isId(stageId) && setAmount(key("s", site, stageId), amount);

  /** Nowa wpłata; `false` = zła kwota/dzień albo za dużo wpłat. */
  function addPayment(site: string, p: Payment): boolean {
    const clean = isId(site) && isId(p.id) ? cleanPayment(p, p.id) : null;
    if (!clean || get(site).payments.length >= PAYMENTS_MAX) return false;
    const { id, ...value } = clean;
    doc.transact(() => map.set(key("p", site, id), value), BILLING_ORIGIN);
    return true;
  }
  const removePayment = (site: string, id: string) => {
    const k = key("p", site, id);
    if (map.has(k)) doc.transact(() => map.delete(k), BILLING_ORIGIN);
  };

  function dump(): BillingDump {
    return { sites: Object.fromEntries(all()) };
  }

  /** Scala kopię: pola, których tu nie ma, dochodzą; istniejące zostają. */
  function mergeDump(raw: unknown): void {
    const sites = (raw as Partial<BillingDump> | null)?.sites;
    if (!sites || typeof sites !== "object") return;
    const put = (k: string, v: unknown) => { if (v !== undefined && !map.has(k)) map.set(k, v); };
    const entries = (o: unknown) => (o && typeof o === "object" ? Object.entries(o as Record<string, unknown>) : []);
    doc.transact(() => {
      for (const [site, data] of Object.entries(sites)) {
        if (!isId(site) || !data || typeof data !== "object") continue;
        const d = data as Partial<StoredBilling>;
        put(key("m", site), cleanModes(d.modes));
        put(key("d", site), cleanAmount(d.pointRate));
        put(key("l", site), cleanAmount(d.lump));
        for (const [t, v] of entries(d.typeRates)) if (isId(t)) put(key("t", site, t), cleanAmount(v));
        for (const [s, v] of entries(d.stageAmounts)) if (isId(s)) put(key("s", site, s), cleanAmount(v));
        for (const v of Array.isArray(d.payments) ? d.payments : []) {
          const id = (v as Partial<Payment> | null)?.id;
          const pay = typeof id === "string" && isId(id) ? cleanPayment(v, id) : null;
          if (pay) { const { id: _, ...value } = pay; put(key("p", site, pay.id), value); }
        }
      }
    }, BILLING_ORIGIN);
  }

  return { get, subscribe, setModes, setPointRate, setLump, setStageAmount, addPayment, removePayment, dump, mergeDump };
}
