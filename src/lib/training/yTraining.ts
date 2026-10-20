import * as Y from "yjs";
import { byTrainingTime, cleanEntry, cleanEquipment, cleanPlanDay, cleanTrainingReminder, PLAN_MAX_DAYS, TRAINING_MAX_ENTRIES, type PlanDay, type TrainingEntry, type TrainingEquipment, type TrainingReminder } from "./model";

/**
 * Trening w Y.Doc notatek — ten sam dokument co synchronizacja, plik i kopia.
 * Każdy wpis dziennika i każdy plan to osobny klucz mapy, więc dwa telefony scalają się bez strat.
 */

/** Origin transakcji Treningu — odróżnia lokalne zmiany od tych z sieci. */
export const TRAINING_ORIGIN = "training";

export interface TrainingDump {
  entries: TrainingEntry[];
  plans: PlanDay[];
  reminder: TrainingReminder | null;
  equipment?: TrainingEquipment;
}

export function createYTraining(doc: Y.Doc) {
  const log = doc.getMap<TrainingEntry>("trainingLog");
  const plans = doc.getMap<PlanDay>("trainingPlans");
  // Ustawienia treningu (przypomnienie, sprzęt): wartości czyszczone przy odczycie, więc typ `unknown`.
  const meta = doc.getMap<unknown>("trainingMeta");
  let entriesSnap: TrainingEntry[] | null = null;
  let plansSnap: PlanDay[] | null = null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  log.observe(() => { entriesSnap = null; emit(); });
  plans.observe(() => { plansSnap = null; emit(); });
  // Ustawienia są czytane przez useSyncExternalStore: odczyt musi zwracać ten sam obiekt, dopóki mapa się nie zmieni.
  let metaSnap: { reminder: TrainingReminder | null; equipment: TrainingEquipment } | null = null;
  const metaSnapshot = () => {
    if (!metaSnap) metaSnap = { reminder: cleanTrainingReminder(meta.get("reminder")), equipment: cleanEquipment(meta.get("equipment")) };
    return metaSnap;
  };
  meta.observe(() => { metaSnap = null; emit(); });

  /** Ustawienie przypomnienia o treningu; `null` = wyłączone. */
  function getReminder(): TrainingReminder | null {
    return metaSnapshot().reminder;
  }

  /** Zapis przechodzi przez czyszczenie: zła godzina nie trafia do dokumentu (M2, M3). */
  function setReminder(r: TrainingReminder | null): void {
    const clean = r ? cleanTrainingReminder(r) : null;
    doc.transact(() => {
      if (clean) meta.set("reminder", clean); else meta.delete("reminder");
    }, TRAINING_ORIGIN);
  }

  /** Sprzęt w domu (największy ciężar hantli). */
  function getEquipment(): TrainingEquipment {
    return metaSnapshot().equipment;
  }

  function setEquipment(e: TrainingEquipment): void {
    doc.transact(() => meta.set("equipment", cleanEquipment(e) as TrainingEquipment), TRAINING_ORIGIN);
  }

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
    return { entries: getEntries(), plans: getPlans(), reminder: getReminder(), equipment: getEquipment() };
  }

  /**
   * Scala zrzut z kopii: dodaje to, czego nie ma, i niczego nie kasuje. Przypomnienie z kopii
   * trafia tylko wtedy, gdy na tym telefonie go nie ma.
   */
  function mergeDump(raw: unknown, hasNote?: (id: string) => boolean): void {
    const d = raw as Partial<TrainingDump> | null;
    const inEntries = Array.isArray(d?.entries) ? d.entries.map(cleanEntry).filter((e): e is TrainingEntry => !!e) : [];
    const inPlans = Array.isArray(d?.plans) ? d.plans.map(cleanPlanDay).filter((p): p is PlanDay => !!p) : [];
    const inReminder = cleanTrainingReminder(d?.reminder);
    const inEquipment = cleanEquipment(d?.equipment);
    // Przypomnienie żyje, gdy jego notatka istnieje (H2): po przywróceniu kopii notatki są inne.
    const alive = (r: TrainingReminder | null) => !!r && (!r.noteId || !hasNote || hasNote(r.noteId));
    const localReminder = getReminder();
    doc.transact(() => {
      for (const e of inEntries) if (!log.has(e.id) && log.size < TRAINING_MAX_ENTRIES) log.set(e.id, e);
      for (const p of inPlans) if (!plans.has(p.id) && plans.size < PLAN_MAX_DAYS) plans.set(p.id, p);
      if (localReminder && !alive(localReminder)) meta.delete("reminder");
      if (inReminder && alive(inReminder) && !alive(getReminder())) meta.set("reminder", inReminder);
      if (inEquipment.dumbbellMaxKg !== undefined && getEquipment().dumbbellMaxKg === undefined) meta.set("equipment", inEquipment);
    }, TRAINING_ORIGIN);
  }

  return { getEntries, getPlans, getReminder, setReminder, getEquipment, setEquipment, subscribe, addEntry, removeEntry, restoreEntry, addPlan, removePlan, restorePlan, dump, mergeDump };
}
