import { useSyncExternalStore } from "react";
import { yjsStore } from "@/lib/yjsStore";
import { localDayKey } from "@/lib/dayDone";
import { cleanEntry, cleanPlanDay, type PlanDay, type TrainingEntry, type TrainingEquipment, type TrainingReminder, type TrainingSet } from "./model";
import { createYTraining } from "./yTraining";

/**
 * Trening żyje w dokumencie Yjs notatek (`yTraining.ts`). Komponenty czytają przez hooki,
 * a zmieniają wyłącznie akcjami poniżej.
 */
const yTraining = createYTraining(yjsStore.doc);

export function useTrainingEntries(): TrainingEntry[] {
  return useSyncExternalStore(yTraining.subscribe, yTraining.getEntries);
}

export function useTrainingPlans(): PlanDay[] {
  return useSyncExternalStore(yTraining.subscribe, yTraining.getPlans);
}

export interface NewTrainingEntryInput {
  exerciseId: string;
  sets: TrainingSet[];
  note?: string;
  /** Dzień `YYYY-MM-DD`; domyślnie dziś. */
  day?: string;
  time?: string;
}

/** `null` = niepoprawne dane (nieznane ćwiczenie, brak serii, pełny dziennik). */
export function addTrainingEntry(input: NewTrainingEntryInput): TrainingEntry | null {
  const entry = cleanEntry({
    id: `t-${crypto.randomUUID()}`,
    day: input.day ?? localDayKey(),
    time: input.time || undefined,
    exerciseId: input.exerciseId,
    sets: input.sets,
    note: input.note ?? "",
    created: Date.now(),
  });
  if (!entry) return null;
  return yTraining.addEntry(entry) ? entry : null;
}

export function removeTrainingEntry(id: string): TrainingEntry | null {
  return yTraining.removeEntry(id);
}

export function restoreTrainingEntry(e: TrainingEntry): void {
  yTraining.restoreEntry(e);
}

export interface NewPlanDayInput {
  name: string;
  exerciseIds: string[];
  targetSets: number;
  targetReps: number;
}

/** `null` = niepoprawny plan (pusta nazwa, brak ćwiczeń, pełna lista planów). */
export function addPlanDay(input: NewPlanDayInput): PlanDay | null {
  const plan = cleanPlanDay({
    id: `p-${crypto.randomUUID()}`,
    name: input.name,
    exerciseIds: input.exerciseIds,
    targetSets: input.targetSets,
    targetReps: input.targetReps,
    created: Date.now(),
  });
  if (!plan) return null;
  return yTraining.addPlan(plan) ? plan : null;
}

export function removePlanDay(id: string): PlanDay | null {
  return yTraining.removePlan(id);
}

export function restorePlanDay(p: PlanDay): void {
  yTraining.restorePlan(p);
}

/** Zrzut treningu do kopii zapasowej. */
export function trainingDump() {
  return yTraining.dump();
}

/** Scalenie treningu z kopii — bez kasowania tego, co już jest na telefonie. */
export function mergeTrainingDump(raw: unknown, hasNote?: (id: string) => boolean): void {
  yTraining.mergeDump(raw, hasNote);
}

export function useTrainingReminder(): TrainingReminder | null {
  return useSyncExternalStore(yTraining.subscribe, yTraining.getReminder);
}

/** Zapis ustawienia przypomnienia (`null` = wyłączone). Notatkę-przypomnienie tworzy widok. */
export function setTrainingReminder(r: TrainingReminder | null): void {
  yTraining.setReminder(r);
}

export function useTrainingEquipment(): TrainingEquipment {
  return useSyncExternalStore(yTraining.subscribe, yTraining.getEquipment);
}

export function setTrainingEquipment(e: TrainingEquipment): void {
  yTraining.setEquipment(e);
}
