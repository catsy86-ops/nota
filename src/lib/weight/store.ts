import { useSyncExternalStore } from "react";
import { yjsStore } from "@/lib/yjsStore";
import type { WeightEntry } from "./model";
import { createYWeight } from "./yWeight";
import { createYMeasures } from "./yMeasures";
import type { Measure, MeasurePart } from "./measures";

/** Masa ciała żyje w dokumencie Yjs notatek (`yWeight.ts`); zmiany idą wyłącznie przez akcje poniżej. */
const yWeight = createYWeight(yjsStore.doc);

export function useWeights(): WeightEntry[] {
  return useSyncExternalStore(yWeight.subscribe, yWeight.get);
}

/** Zapis ważenia dnia; `false` = niepoprawna wartość albo pełna historia. */
export function setWeight(day: string, kg: number): boolean {
  return yWeight.set({ day, kg, created: Date.now() });
}

/** Usuwa ważenie dnia i zwraca je (do „Cofnij”). */
export function removeWeight(day: string): WeightEntry | null {
  return yWeight.remove(day);
}

export function restoreWeight(entry: WeightEntry): void {
  yWeight.set(entry);
}

/** Zrzut masy ciała do kopii zapasowej. */
export function weightDump(): WeightEntry[] {
  return yWeight.dump();
}

/** Scalenie z kopii — bez kasowania tego, co już jest na telefonie. */
export function mergeWeightDump(raw: unknown): void {
  yWeight.mergeDump(raw);
}

// C3.4 Obwody ciała — osobna mapa `bodyMeasures` (`yMeasures.ts`), ten sam dokument.
const yMeasures = createYMeasures(yjsStore.doc);

export function useMeasures(): Measure[] {
  return useSyncExternalStore(yMeasures.subscribe, yMeasures.get);
}

/** Zapis pomiaru partii w dniu; `false` = niepoprawna wartość albo pełna historia. */
export function setMeasure(day: string, part: MeasurePart, cm: number): boolean {
  return yMeasures.set({ day, part, cm, created: Date.now() });
}

export function removeMeasure(part: MeasurePart, day: string): Measure | null {
  return yMeasures.remove(part, day);
}

export function restoreMeasure(m: Measure): void {
  yMeasures.set(m);
}

/** Zrzut obwodów do kopii (sekcja „Obwody”). */
export function measuresDump(): Measure[] {
  return yMeasures.dump();
}

export function mergeMeasuresDump(raw: unknown): void {
  yMeasures.mergeDump(raw);
}
