import * as Y from "yjs";
import { mergeStored, toStored } from "@/lib/extraFields";
import { byMealOrder, cleanFavorite, cleanGoals, cleanMeal, DIET_MAX_FAVORITES, DIET_MAX_MEALS, favoriteId, type DietGoals, type Meal, type MealFavorite, type MealTemplate, GOALS_KNOWN } from "./model";

/**
 * Dieta w Y.Doc notatek — ten sam dokument, który niesie synchronizację, plik i kopię.
 * Każdy posiłek to osobny klucz mapy, więc dwa telefony dopisujące różne posiłki scalają się bez strat.
 * Cele to jeden klucz (`goals`) w osobnej mapie. Ulubione (C4.1) — mapa `dietFavorites`, klucz = id z opisu.
 */

/** Origin transakcji Diety — odróżnia lokalne zmiany od tych z sieci. */
export const DIET_ORIGIN = "diet";

export interface DietDump {
  meals: Meal[];
  goals: DietGoals;
  /** C4.1; brak w kopiach sprzed 2026-11-26. */
  favorites?: MealFavorite[];
}

export function createYDiet(doc: Y.Doc) {
  const meals = doc.getMap<Meal>("dietMeals");
  const meta = doc.getMap<DietGoals>("dietMeta");
  const favorites = doc.getMap<MealFavorite>("dietFavorites");
  let snapshot: Meal[] | null = null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  meals.observe(() => { snapshot = null; emit(); });
  // Cele czytane przez useSyncExternalStore: odczyt musi zwracać ten sam obiekt, dopóki mapa się nie zmieni.
  let goalsSnap: DietGoals | null = null;
  meta.observe(() => { goalsSnap = null; emit(); });
  let favSnap: MealFavorite[] | null = null;
  favorites.observe(() => { favSnap = null; emit(); });

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
    // L6: zamrożony — wywołujący nie zmieni cache przez referencję.
    if (!goalsSnap) goalsSnap = Object.freeze(cleanGoals(meta.get("goals"))) as DietGoals;
    return goalsSnap;
  }

  /** Ulubione w kolejności przypięcia. */
  function getFavorites(): MealFavorite[] {
    if (favSnap) return favSnap;
    const out: MealFavorite[] = [];
    for (const raw of favorites.values()) {
      const f = cleanFavorite(raw);
      if (f) out.push(f);
    }
    favSnap = out.sort((a, b) => a.created - b.created || (a.id < b.id ? -1 : 1));
    return favSnap;
  }

  /** Przypina posiłek; ten sam opis drugi raz nic nie zmienia. `null` — pusty opis albo pełna lista. */
  function pin(t: MealTemplate, created: number): MealFavorite | null {
    const f = cleanFavorite({ ...t, id: favoriteId(t.text), created });
    if (!f) return null;
    const had = cleanFavorite(favorites.get(f.id));
    if (had) return had;
    if (favorites.size >= DIET_MAX_FAVORITES) return null;
    doc.transact(() => favorites.set(f.id, toStored(f) as MealFavorite), DIET_ORIGIN);
    return f;
  }

  function unpin(id: string): MealFavorite | null {
    const prev = cleanFavorite(favorites.get(id));
    if (!prev) return null;
    doc.transact(() => favorites.delete(id), DIET_ORIGIN);
    return prev;
  }

  /** „Cofnij” odpięcia: wraca z tym samym id i miejscem. */
  function repin(f: MealFavorite): boolean {
    if (favorites.size >= DIET_MAX_FAVORITES && !favorites.has(f.id)) return false;
    doc.transact(() => favorites.set(f.id, toStored(f) as MealFavorite), DIET_ORIGIN);
    return true;
  }

  function subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }

  function add(m: Meal): boolean {
    if (meals.size >= DIET_MAX_MEALS || meals.has(m.id)) return false;
    doc.transact(() => meals.set(m.id, toStored(m) as Meal), DIET_ORIGIN);
    return true;
  }

  function remove(id: string): Meal | null {
    const prev = cleanMeal(meals.get(id));
    if (!prev) return null;
    doc.transact(() => meals.delete(id), DIET_ORIGIN);
    return prev;
  }

  /** Cofnięcie usunięcia: posiłek wraca z tym samym id i godziną; `false` gdy lista jest pełna (L6: limit obowiązuje także tu). */
  function restore(m: Meal): boolean {
    if (meals.size >= DIET_MAX_MEALS && !meals.has(m.id)) return false;
    doc.transact(() => meals.set(m.id, toStored(m) as Meal), DIET_ORIGIN);
    return true;
  }

  function setGoals(goals: DietGoals): void {
    // Cele z formularza nadpisują zapis — pola nowszej wersji z bieżących celów przechodzą (D1.1).
    doc.transact(() => meta.set("goals", mergeStored(cleanGoals(goals), meta.get("goals"), GOALS_KNOWN) as DietGoals), DIET_ORIGIN);
  }

  function dump(): DietDump {
    // Bez ulubionych pole nie trafia do kopii — kopia wygląda jak dotąd.
    const favs = getFavorites();
    return { meals: get().map((m) => toStored(m) as Meal), goals: toStored(getGoals()) as DietGoals, ...(favs.length ? { favorites: favs.map((f) => toStored(f) as MealFavorite) } : {}) };
  }

  /**
   * Scala zrzut z kopii: dodaje brakujące posiłki i ulubione, ustawia cele tylko wtedy, gdy na tym telefonie ich nie ma.
   * Niczego nie kasuje.
   */
  function mergeDump(raw: unknown): void {
    const d = raw as Partial<DietDump> | null;
    const incoming = Array.isArray(d?.meals) ? d.meals.map(cleanMeal).filter((m): m is Meal => !!m) : [];
    const favs = Array.isArray(d?.favorites) ? d.favorites.map(cleanFavorite).filter((f): f is MealFavorite => !!f) : [];
    const goals = cleanGoals(d?.goals);
    const hasGoals = goals.kcal !== undefined || goals.protein !== undefined;
    doc.transact(() => {
      for (const m of incoming) if (!meals.has(m.id) && meals.size < DIET_MAX_MEALS) meals.set(m.id, toStored(m) as Meal);
      for (const f of favs) if (!favorites.has(f.id) && favorites.size < DIET_MAX_FAVORITES) favorites.set(f.id, toStored(f) as MealFavorite);
      if (hasGoals && Object.keys(getGoals()).length === 0) meta.set("goals", toStored(goals) as DietGoals);
    }, DIET_ORIGIN);
  }

  return { get, getGoals, getFavorites, subscribe, add, remove, restore, pin, unpin, repin, setGoals, dump, mergeDump };
}
