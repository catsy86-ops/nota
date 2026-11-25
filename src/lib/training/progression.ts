import { byTrainingTime, overDumbbell, type PlanDay, type TrainingEntry, type TrainingEquipment } from "./model";

/**
 * C2.1 Podwójna progresja: gdy w ostatniej sesji ćwiczenia każda seria z ciężarem doszła do celu powtórek —
 * „dołóż” (0,5 kg do 10 kg, wyżej 1 kg); gdy nie — „te same kg, o powtórkę więcej”. Limit hantli z „Sprzętu”
 * zamienia „dołóż” na powtórki. Bez celu powtórek, bez historii albo dla serii na czas / bez ciężaru — `null`.
 */
export type ProgressionHint =
  | { kind: "add"; kg: number; reps: number }
  | { kind: "reps"; kg: number; reps: number; capped: boolean };

const stepFor = (kg: number) => (kg < 10 ? 0.5 : 1);

export function suggestNext(
  entries: readonly TrainingEntry[],
  exerciseId: string,
  targetReps: number | undefined,
  exerciseEquipment: readonly string[],
  equipment: TrainingEquipment,
): ProgressionHint | null {
  if (!targetReps || targetReps <= 0) return null;
  const own = entries.filter((e) => e.exerciseId === exerciseId).sort(byTrainingTime);
  const last = own[own.length - 1];
  if (!last) return null;
  const work = last.sets.filter((s) => s.kg !== undefined && s.kg > 0 && s.seconds === undefined);
  if (work.length === 0 || work.length !== last.sets.length) return null;
  const kg = Math.max(...work.map((s) => s.kg as number));
  const top = work.filter((s) => s.kg === kg);
  const minReps = Math.min(...top.map((s) => s.reps));
  if (top.every((s) => s.reps >= targetReps)) {
    const next = Math.round((kg + stepFor(kg)) * 10) / 10;
    if (!overDumbbell(next, exerciseEquipment, equipment)) return { kind: "add", kg: next, reps: targetReps };
    return { kind: "reps", kg, reps: minReps + 1, capped: true };
  }
  return { kind: "reps", kg, reps: minReps + 1, capped: false };
}

/** Cel powtórek dla ćwiczenia: z prowadzonej sesji, a bez niej z pierwszego dnia planu, który je zawiera. */
export function targetRepsFor(exerciseId: string, plans: readonly PlanDay[], sessionTarget?: number): number | undefined {
  return sessionTarget ?? plans.find((p) => p.exerciseIds.includes(exerciseId))?.targetReps;
}

const kgText = (kg: number) => String(kg).replace(".", ",");

/** Zdanie pod „Ostatnio”. */
export function progressionText(h: ProgressionHint): string {
  if (h.kind === "add") return `Dołóż: ${kgText(h.kg)} kg × ${h.reps}`;
  return h.capped
    ? `Hantle już na maksimum — zostań przy ${kgText(h.kg)} kg, celuj w ${h.reps} powtórzeń`
    : `Te same ${kgText(h.kg)} kg, o powtórkę więcej: ${h.reps}`;
}
