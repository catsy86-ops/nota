import * as Y from "yjs";
import { byTrainingTime, cleanEntry, cleanPlanDay, PLAN_MAX_DAYS, TRAINING_MAX_ENTRIES, type PlanDay, type TrainingEntry } from "./model";

/**
 * Trening w Y.Doc notatek — ten sam dokument co synchronizacja, plik i kopia.
 * Każdy wpis dziennika i każdy plan to osobny klucz mapy, więc dwa telefony scalają się bez strat.
 */

/** Origin transakcji Treningu — odróżnia lokalne zmiany od tych z sieci. */
export const TRAINING_ORIGIN = "training";

export interface TrainingDump {
  entries: TrainingEntry[];
  plans: PlanDay[];
}

export function createYTraining(doc: Y.Doc) {
  const log = doc.getMap<TrainingEntry>("trainingLog");
  const plans = doc.getMap<PlanDay>("trainingPlans");
  let entriesSnap: TrainingEntry[] | null = null;
  let plansSnap: PlanDay[] | null = null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  log.observe(() => { entriesSnap = null; emit(); });
  plans.observe(() => { plansSnap = null; emit(); });

  /** Oczyszczony dziennik, chronologicznie. */
  function getEntries(): TrainingEntry[] {
    if (entriesSnap) return entriesSnap;
    const out: TrainingEntry[] = [];
    for (const raw of log.values()) {
      const e = cleanEntry(raw);
      if (e) out.push(e);
    }
    entriesSnap = out.sort(byTrainingTime);
    return entriesSnap;
  }

  /** Plany dni w kolejności dodania. */
  function getPlans(): PlanDay[] {
    if (plansSnap) return plansSnap;
    const out: PlanDay[] = [];
    for (const raw of plans.values()) {
      const p = cleanPlanDay(raw);
      if (p) out.push(p);
    }
    plansSnap = out.sort((a, b) => a.created - b.created);
    return plansSnap;
  }

  function subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }

  function addEntry(e: TrainingEntry): boolean {
    if (log.size >= TRAINING_MAX_ENTRIES || log.has(e.id)) return false;
    doc.transact(() => log.set(e.id, e), TRAINING_ORIGIN);
    return true;
  }

  function removeEntry(id: string): TrainingEntry | null {
    const prev = cleanEntry(log.get(id));
    if (!prev) return null;
    doc.transact(() => log.delete(id), TRAINING_ORIGIN);
    return prev;
  }

  function restoreEntry(e: TrainingEntry): void {
    doc.transact(() => log.set(e.id, e), TRAINING_ORIGIN);
  }

  function addPlan(p: PlanDay): boolean {
    if (plans.size >= PLAN_MAX_DAYS || plans.has(p.id)) return false;
    doc.transact(() => plans.set(p.id, p), TRAINING_ORIGIN);
    return true;
  }

  function removePlan(id: string): PlanDay | null {
    const prev = cleanPlanDay(plans.get(id));
    if (!prev) return null;
    doc.transact(() => plans.delete(id), TRAINING_ORIGIN);
    return prev;
  }

  function restorePlan(p: PlanDay): void {
    doc.transact(() => plans.set(p.id, p), TRAINING_ORIGIN);
  }

  function dump(): TrainingDump {
    return { entries: getEntries(), plans: getPlans() };
  }

  /** Scala zrzut z kopii: dodaje to, czego nie ma. Niczego nie kasuje. */
  function mergeDump(raw: unknown): void {
    const d = raw as Partial<TrainingDump> | null;
    const inEntries = Array.isArray(d?.entries) ? d.entries.map(cleanEntry).filter((e): e is TrainingEntry => !!e) : [];
    const inPlans = Array.isArray(d?.plans) ? d.plans.map(cleanPlanDay).filter((p): p is PlanDay => !!p) : [];
    doc.transact(() => {
      for (const e of inEntries) if (!log.has(e.id) && log.size < TRAINING_MAX_ENTRIES) log.set(e.id, e);
      for (const p of inPlans) if (!plans.has(p.id) && plans.size < PLAN_MAX_DAYS) plans.set(p.id, p);
    }, TRAINING_ORIGIN);
  }

  return { getEntries, getPlans, subscribe, addEntry, removeEntry, restoreEntry, addPlan, removePlan, restorePlan, dump, mergeDump };
}
