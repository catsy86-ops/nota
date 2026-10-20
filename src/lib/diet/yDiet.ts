import * as Y from "yjs";
import { byMealOrder, cleanGoals, cleanMeal, DIET_MAX_MEALS, type DietGoals, type Meal } from "./model";

/**
 * Dieta w Y.Doc notatek — ten sam dokument, który niesie synchronizację, plik i kopię.
 * Każdy posiłek to osobny klucz mapy, więc dwa telefony dopisujące różne posiłki scalają się bez strat.
 * Cele to jeden klucz (`goals`) w osobnej mapie.
 */

/** Origin transakcji Diety — odróżnia lokalne zmiany od tych z sieci. */
export const DIET_ORIGIN = "diet";

export interface DietDump {
  meals: Meal[];
  goals: DietGoals;
}

export function createYDiet(doc: Y.Doc) {
  const meals = doc.getMap<Meal>("dietMeals");
  const meta = doc.getMap<DietGoals>("dietMeta");
  let snapshot: Meal[] | null = null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  meals.observe(() => { snapshot = null; emit(); });
  meta.observe(emit);

  /** Oczyszczone posiłki, od najstarszego dnia; w dniu wg godziny. */
  function get(): Meal[] {
    if (snapshot) return snapshot;
    const out: Meal[] = [];
    for (const raw of meals.values()) {
      const m = cleanMeal(raw);
      if (m) out.push(m);
    }
    snapshot = out.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : byMealOrder(a, b)));
    return snapshot;
  }

  function getGoals(): DietGoals {
    return cleanGoals(meta.get("goals"));
  }

  function subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }

  function add(m: Meal): boolean {
    if (meals.size >= DIET_MAX_MEALS || meals.has(m.id)) return false;
    doc.transact(() => meals.set(m.id, m), DIET_ORIGIN);
    return true;
  }

  function remove(id: string): Meal | null {
    const prev = cleanMeal(meals.get(id));
    if (!prev) return null;
    doc.transact(() => meals.delete(id), DIET_ORIGIN);
    return prev;
  }

  /** Cofnięcie usunięcia: posiłek wraca z tym samym id i godziną. */
  function restore(m: Meal): void {
    doc.transact(() => meals.set(m.id, m), DIET_ORIGIN);
  }

  function setGoals(goals: DietGoals): void {
    doc.transact(() => meta.set("goals", cleanGoals(goals)), DIET_ORIGIN);
  }

  function dump(): DietDump {
    return { meals: get(), goals: getGoals() };
  }

  /**
   * Scala zrzut z kopii: dodaje brakujące posiłki i ustawia cele tylko wtedy, gdy na tym telefonie ich nie ma.
   * Niczego nie kasuje.
   */
  function mergeDump(raw: unknown): void {
    const d = raw as Partial<DietDump> | null;
    const incoming = Array.isArray(d?.meals) ? d.meals.map(cleanMeal).filter((m): m is Meal => !!m) : [];
    const goals = cleanGoals(d?.goals);
    const hasGoals = goals.kcal !== undefined || goals.protein !== undefined;
    doc.transact(() => {
      for (const m of incoming) if (!meals.has(m.id) && meals.size < DIET_MAX_MEALS) meals.set(m.id, m);
      if (hasGoals && Object.keys(getGoals()).length === 0) meta.set("goals", goals);
    }, DIET_ORIGIN);
  }

  return { get, getGoals, subscribe, add, remove, restore, setGoals, dump, mergeDump };
}
