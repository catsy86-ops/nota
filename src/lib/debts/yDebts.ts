import * as Y from "yjs";
import { byNewest, cleanDebt, DEBT_MAX_ENTRIES, type DebtEntry } from "./model";
import { toStored } from "@/lib/extraFields";
import { cleanPlan, type DebtPlan } from "./plans";
import { cleanProof, DEBT_PROOFS_MAP, type DebtProof } from "./proofs";

/**
 * Długi w Y.Doc notatek — tym samym, który niesie synchronizację, plik i kopię.
 * Każdy wpis to osobny klucz mapy, więc dwa telefony dopisujące różne pożyczki
 * scalają się bez strat; ten sam wpis edytowany równocześnie wygrywa w całości.
 */

/** Origin transakcji Długów — odróżnia lokalne zmiany od tych z sieci. */
export const DEBTS_ORIGIN = "debts";

export function createYDebts(doc: Y.Doc) {
  const entries = doc.getMap<DebtEntry>("debts");
  /** Raty (L2.1): plan na wpis pożyczki, klucz `planId`. */
  const plansMap = doc.getMap<DebtPlan>("debtPlans");
  /** Zdjęcia dowodów (L4.3): id wpisu → `{ ref, at }`. */
  const proofsMap = doc.getMap<DebtProof>(DEBT_PROOFS_MAP);
  let proofsSnapshot: Map<string, DebtProof> | null = null;
  let snapshot: DebtEntry[] | null = null;
  let plansSnapshot: DebtPlan[] | null = null;
  const listeners = new Set<() => void>();
  const changed = () => {
    snapshot = null;
    plansSnapshot = null;
    proofsSnapshot = null;
    listeners.forEach((l) => l());
  };
  entries.observe(changed);
  plansMap.observe(changed);
  proofsMap.observe(changed);

  /** Dowody wpisów, które istnieją (sieroty z drugiego telefonu pomijane w interfejsie, nie w odśmiecaniu). */
  function proofs(): Map<string, DebtProof> {
    if (proofsSnapshot) return proofsSnapshot;
    const live = new Set(get().map((e) => e.id));
    const out = new Map<string, DebtProof>();
    for (const [id, raw] of proofsMap.entries()) {
      const p = cleanProof(raw);
      if (p && live.has(id)) out.set(id, p);
    }
    proofsSnapshot = out;
    return out;
  }

  /** Dowód wpisu; `null` usuwa. `false` — wpisu nie ma albo zły klucz obrazu. */
  function setProof(entryId: string, ref: string | null, at = Date.now()): boolean {
    if (!entries.has(entryId)) return false;
    if (ref === null) {
      if (proofsMap.has(entryId)) doc.transact(() => proofsMap.delete(entryId), DEBTS_ORIGIN);
      return true;
    }
    const p = cleanProof({ ref, at });
    if (!p) return false;
    doc.transact(() => proofsMap.set(entryId, p), DEBTS_ORIGIN);
    return true;
  }
  /** Dowody zdjęte razem z wpisem — wracają z „Cofnij” (`restore`). */
  const droppedProofs = new Map<string, DebtProof>();
  function dropProofOf(entryId: string): void {
    const p = cleanProof(proofsMap.get(entryId));
    if (p) droppedProofs.set(entryId, p); else droppedProofs.delete(entryId);
    if (proofsMap.has(entryId)) proofsMap.delete(entryId);
  }

  /** Oczyszczona lista, najnowsze pierwsze; śmieci od peera są pomijane po cichu. */
  // `fresh` — bez pamięci podręcznej: w środku transakcji obserwator jeszcze jej nie wyczyścił.
  function get(fresh = false): DebtEntry[] {
    if (snapshot && !fresh) return snapshot;
    const out: DebtEntry[] = [];
    for (const raw of entries.values()) {
      const e = cleanDebt(raw);
      if (e) out.push(e);
    }
    out.sort(byNewest);
    if (!fresh) snapshot = out;
    return out;
  }

  /**
   * Plany rat: tylko te, których pożyczka istnieje (sieroty z drugiego telefonu są pomijane), jeden na wpis — przy dwóch
   * (dwa telefony utworzyły plan naraz) wygrywa starszy, potem mniejszy id, tak samo na każdym urządzeniu.
   */
  function plans(fresh = false): DebtPlan[] {
    if (plansSnapshot && !fresh) return plansSnapshot;
    const live = new Set(get(fresh).map((e) => e.id));
    const byEntry = new Map<string, DebtPlan>();
    for (const raw of plansMap.values()) {
      const p = cleanPlan(raw);
      if (!p || !live.has(p.entryId)) continue;
      const cur = byEntry.get(p.entryId);
      if (!cur || p.created < cur.created || (p.created === cur.created && p.id < cur.id)) byEntry.set(p.entryId, p);
    }
    const out = [...byEntry.values()];
    if (!fresh) plansSnapshot = out;
    return out;
  }

  function addPlan(plan: DebtPlan): boolean {
    if (plansMap.has(plan.id) || !entries.has(plan.entryId)) return false;
    doc.transact(() => plansMap.set(plan.id, toStored(plan) as DebtPlan), DEBTS_ORIGIN);
    return true;
  }

  function removePlan(id: string): void {
    if (plansMap.has(id)) doc.transact(() => plansMap.delete(id), DEBTS_ORIGIN);
  }

  /** Plany pożyczki `entryId` — usuwane razem z nią, w tej samej transakcji (§1.4, zasada 2). */
  // „Cofnij” usunięcia pożyczki oddaje też jej plan (`restore`).
  const droppedPlans = new Map<string, DebtPlan[]>();
  function dropPlansOf(entryId: string): void {
    const gone: DebtPlan[] = [];
    for (const [id, raw] of plansMap.entries()) {
      if ((raw as { entryId?: unknown } | undefined)?.entryId !== entryId) continue;
      const p = cleanPlan(raw);
      if (p) gone.push(p);
      plansMap.delete(id);
    }
    if (gone.length) droppedPlans.set(entryId, gone); else droppedPlans.delete(entryId);
  }

  function subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }

  /** Każdy zapis przez tę funkcję: nieznane pola (`extra`) wracają na wierzch wpisu (Z-17.3). */
  const put = (e: DebtEntry) => entries.set(e.id, toStored(e) as DebtEntry);

  function add(entry: DebtEntry): boolean {
    if (entries.size >= DEBT_MAX_ENTRIES || entries.has(entry.id)) return false;
    doc.transact(() => put(entry), DEBTS_ORIGIN);
    return true;
  }

  function remove(id: string): DebtEntry | null {
    const prev = cleanDebt(entries.get(id));
    // L9: uszkodzony wpis (nie przechodzi czyszczenia) też da się usunąć — inaczej zajmuje miejsce w limicie.
    if (!prev) {
      if (entries.has(id)) doc.transact(() => { entries.delete(id); dropPlansOf(id); dropProofOf(id); }, DEBTS_ORIGIN);
      return null;
    }
    doc.transact(() => { entries.delete(id); dropPlansOf(id); dropProofOf(id); }, DEBTS_ORIGIN);
    return prev;
  }

  /** Zmiana istniejącego wpisu (ten sam id): kwota, dzień, notatka, rodzaj, osoba. `false` gdy wpisu nie ma. */
  function replace(entry: DebtEntry): boolean {
    if (!entries.has(entry.id)) return false;
    doc.transact(() => put(entry), DEBTS_ORIGIN);
    return true;
  }

  /** Kilka zmian jedną transakcją (3.1: zmiana nazwy, łączenie, cofnięcie). Wpisów, których nie ma, nie dodaje. */
  function replaceMany(list: readonly DebtEntry[]): number {
    let n = 0;
    doc.transact(() => {
      for (const e of list) if (entries.has(e.id)) { put(e); n++; }
    }, DEBTS_ORIGIN);
    return n;
  }

  /** Cofnięcie usunięcia: wpis wraca z tym samym id i datą. */
  function restore(entry: DebtEntry): void {
    doc.transact(() => {
      put(entry);
      for (const p of droppedPlans.get(entry.id) ?? []) if (!plansMap.has(p.id)) plansMap.set(p.id, toStored(p) as DebtPlan);
      droppedPlans.delete(entry.id);
      const proof = droppedProofs.get(entry.id);
      if (proof && !proofsMap.has(entry.id)) proofsMap.set(entry.id, proof);
      droppedProofs.delete(entry.id);
    }, DEBTS_ORIGIN);
  }

  /** Zrzut do kopii zapasowej: wszystkie pożyczki w kształcie zapisu (nieznane pola na wierzchu). */
  function dump(): DebtEntry[] {
    return get().map((e) => toStored(e) as DebtEntry);
  }

  /**
   * Scala zrzut z kopii: dodaje pożyczki, których jeszcze nie ma (po id), w limicie. Niczego nie kasuje
   * i nie nadpisuje wpisu o tym samym id, który już jest na tym telefonie.
   */
  function mergeDump(raw: unknown): void {
    const incoming = Array.isArray(raw) ? raw.map(cleanDebt).filter((e): e is DebtEntry => !!e) : [];
    doc.transact(() => {
      for (const e of incoming) if (!entries.has(e.id) && entries.size < DEBT_MAX_ENTRIES) put(e);
    }, DEBTS_ORIGIN);
  }

  /** Zrzut planów do kopii (pole `debtPlans`). */
  function dumpPlans(): DebtPlan[] {
    return plans().map((p) => toStored(p) as DebtPlan);
  }

  /** Plany z kopii: tylko nowe id i tylko do istniejących pożyczek (wołać po scaleniu wpisów). */
  function mergePlans(raw: unknown): void {
    const incoming = Array.isArray(raw) ? raw.map(cleanPlan).filter((p): p is DebtPlan => !!p) : [];
    doc.transact(() => {
      for (const p of incoming) if (!plansMap.has(p.id) && entries.has(p.entryId) && plansMap.size < DEBT_MAX_ENTRIES) plansMap.set(p.id, toStored(p) as DebtPlan);
    }, DEBTS_ORIGIN);
  }

  /** Zrzut dowodów do kopii (pole `debtProofs`): id wpisu → dowód. */
  function dumpProofs(): Record<string, DebtProof> {
    return Object.fromEntries(proofs());
  }

  /** Dowody z kopii: tylko do istniejących wpisów bez dowodu (wołać po scaleniu wpisów). */
  function mergeProofs(raw: unknown): void {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
    const incoming = Object.entries(raw as Record<string, unknown>).slice(0, DEBT_MAX_ENTRIES);
    doc.transact(() => {
      for (const [id, v] of incoming) {
        const p = cleanProof(v);
        if (p && entries.has(id) && !proofsMap.has(id)) proofsMap.set(id, p);
      }
    }, DEBTS_ORIGIN);
  }

  /** Kilka zapisów (wpis + skutek w notatce) jedną transakcją dokumentu (§2.1, zasada 6). */
  const transact = (fn: () => void) => doc.transact(fn, DEBTS_ORIGIN);

  return { get, plans, proofs, setProof, subscribe, add, addPlan, removePlan, remove, restore, replace, replaceMany, dump, dumpPlans, dumpProofs, mergeDump, mergePlans, mergeProofs, transact, has: (id: string) => entries.has(id) };
}
