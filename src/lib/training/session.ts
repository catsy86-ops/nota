import type { PlanDay } from "./model";

/**
 * Prowadzony trening (2.1): dzień planu jako lista ćwiczeń do zrobienia po kolei. Stan żyje tylko w widoku (nie jest
 * zapisywany) — wpisy powstają jak zwykle przez dziennik serii, a sesja pilnuje kolejności i liczy podsumowanie.
 */
export interface TrainingSession {
  planName: string;
  exerciseIds: string[];
  /** Indeks bieżącego ćwiczenia; równy długości listy = plan skończony. */
  index: number;
  targetSets: number;
  targetReps: number;
  startedAt: number;
  /** Ile ćwiczeń zapisano, a ile pominięto. */
  logged: number;
  skipped: number;
  volume: number;
  records: number;
}

export function startSession(plan: Pick<PlanDay, "name" | "exerciseIds" | "targetSets" | "targetReps">, now: number): TrainingSession | null {
  if (plan.exerciseIds.length === 0) return null;
  return { planName: plan.name, exerciseIds: [...plan.exerciseIds], index: 0, targetSets: plan.targetSets, targetReps: plan.targetReps, startedAt: now, logged: 0, skipped: 0, volume: 0, records: 0 };
}

export const isFinished = (s: TrainingSession): boolean => s.index >= s.exerciseIds.length;
export const currentExerciseId = (s: TrainingSession): string | undefined => s.exerciseIds[s.index];

/** Zapisano bieżące ćwiczenie: dolicza objętość i rekord, przechodzi dalej. */
export function afterLogged(s: TrainingSession, volume: number, record: boolean): TrainingSession {
  return { ...s, index: s.index + 1, logged: s.logged + 1, volume: s.volume + volume, records: s.records + (record ? 1 : 0) };
}

/** „Pomiń ćwiczenie”: przechodzi dalej bez zapisu. */
export function afterSkipped(s: TrainingSession): TrainingSession {
  return isFinished(s) ? s : { ...s, index: s.index + 1, skipped: s.skipped + 1 };
}

/** Czas od startu w pełnych minutach (co najmniej 1). */
export const sessionMinutes = (s: TrainingSession, now: number): number => Math.max(1, Math.round((now - s.startedAt) / 60_000));
