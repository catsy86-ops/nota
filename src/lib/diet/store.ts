import { useSyncExternalStore } from "react";
import { yjsStore } from "@/lib/yjsStore";
import { localDayKey } from "@/lib/dayDone";
import { cleanMeal, DIET_TEXT_MAX, type DietGoals, type Meal } from "./model";
import { createYDiet } from "./yDiet";

/**
 * Dieta żyje w dokumencie Yjs notatek (`yDiet.ts`). Komponenty czytają przez hooki,
 * a zmieniają wyłącznie akcjami poniżej.
 */
const yDiet = createYDiet(yjsStore.doc);

export function useMeals(): Meal[] {
  return useSyncExternalStore(yDiet.subscribe, yDiet.get);
}

export function useDietGoals(): DietGoals {
  return useSyncExternalStore(yDiet.subscribe, yDiet.getGoals);
}

export interface NewMealInput {
  text: string;
  /** Dzień `YYYY-MM-DD`; domyślnie dziś. */
  day?: string;
  time?: string;
  kcal?: number;
  protein?: number;
}

/** `null` = niepoprawne dane (pusty opis, zły dzień lub godzina, pełna lista). */
export function addMeal(input: NewMealInput): Meal | null {
  const meal: Meal = {
    id: `m-${crypto.randomUUID()}`,
    day: input.day ?? localDayKey(),
    text: input.text.trim().slice(0, DIET_TEXT_MAX),
    created: Date.now(),
    ...(input.time ? { time: input.time } : {}),
    ...(input.kcal !== undefined ? { kcal: input.kcal } : {}),
    ...(input.protein !== undefined ? { protein: input.protein } : {}),
  };
  // Zapis przechodzi przez to samo czyszczenie co odczyt: zła wartość przepada tu, a nie przy czytaniu.
  const clean = cleanMeal(meal);
  if (!clean) return null;
  return yDiet.add(clean) ? clean : null;
}

export function removeMeal(id: string): Meal | null {
  return yDiet.remove(id);
}

export function restoreMeal(m: Meal): void {
  yDiet.restore(m);
}

export function setDietGoals(goals: DietGoals): void {
  yDiet.setGoals(goals);
}

/** Zrzut diety do kopii zapasowej. */
export function dietDump() {
  return yDiet.dump();
}

/** Scalenie diety z kopii — bez kasowania tego, co już jest na telefonie. */
export function mergeDietDump(raw: unknown): void {
  yDiet.mergeDump(raw);
}
