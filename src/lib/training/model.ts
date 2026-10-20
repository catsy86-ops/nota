import { isKnownExercise } from "./catalog";

/**
 * Trening: dziennik serii (ćwiczenie, powtórki × ciężar), plany dni i progres.
 * Czysta logika bez Yjs i React. Wejście z dokumentu, kopii i peera przechodzi przez czyszczenie.
 */

export const TRAINING_MAX_SETS = 30;
export const TRAINING_REPS_MAX = 100;
export const TRAINING_KG_MAX = 500;
export const TRAINING_NOTE_MAX = 200;
export const TRAINING_MAX_ENTRIES = 5_000;
export const PLAN_NAME_MAX = 40;
export const PLAN_MAX_EXERCISES = 12;
export const PLAN_MAX_DAYS = 20;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface TrainingSet {
  reps: number;
  /** Ciężar w kg (co 0,5 kg); brak = bez ciężaru (ćwiczenie z masą ciała albo nieznany). */
  kg?: number;
}

export interface TrainingEntry {
  id: string;
  /** Dzień `YYYY-MM-DD`, lokalny. */
  day: string;
  /** Godzina treningu „HH:MM”; brak = bez godziny. */
  time?: string;
  exerciseId: string;
  sets: TrainingSet[];
  note: string;
  created: number;
}

export interface PlanDay {
  id: string;
  name: string;
  /** Ćwiczenia z katalogu, w kolejności wykonania. */
  exerciseIds: string[];
  /** Cel: ile serii i powtórek na każde ćwiczenie. */
  targetSets: number;
  targetReps: number;
  created: number;
}

/** Przypomnienie o treningu: godzina „HH:MM” (domyślnie 18:00, okno do 20:00) i id notatki-przypomnienia. */
export interface TrainingReminder {
  time: string;
  noteId?: string;
}

export const TRAINING_REMINDER_DEFAULT = "18:00";
/** Koniec okna treningowego — tylko do opisu w przypomnieniu. */
export const TRAINING_WINDOW_END = "20:00";

/** Czyszczenie ustawienia przypomnienia; zła godzina = brak przypomnienia (`null`). */
export function cleanTrainingReminder(raw: unknown): TrainingReminder | null {
  const r = raw as Partial<TrainingReminder> | null;
  if (!r || typeof r !== "object") return null;
  if (typeof r.time !== "string" || !TIME_RE.test(r.time)) return null;
  const noteId = typeof r.noteId === "string" && r.noteId && r.noteId.length <= 64 ? r.noteId : undefined;
  return noteId ? { time: r.time, noteId } : { time: r.time };
}

/** Sprzęt w domu: największy ciężar hantli (kg). Brak = nieznany, nic nie ostrzega. */
export interface TrainingEquipment {
  dumbbellMaxKg?: number;
}

/** Czyszczenie sprzętu: liczba w zakresie 0–500 kg (i większa od zera), inaczej brak. */
export function cleanEquipment(raw: unknown): TrainingEquipment {
  const e = raw as Partial<TrainingEquipment> | null;
  if (!e || typeof e !== "object") return {};
  const max = cleanKg(e.dumbbellMaxKg);
  return max !== undefined && max > 0 ? { dumbbellMaxKg: max } : {};
}

/** Czy ciężar przekracza hantle z ustawienia (tylko dla ćwiczeń z hantlami i znanym limitem). */
export function overDumbbell(kg: number | undefined, exerciseEquipment: readonly string[], equipment: TrainingEquipment): boolean {
  return kg !== undefined && equipment.dumbbellMaxKg !== undefined && exerciseEquipment.includes("hantle") && kg > equipment.dumbbellMaxKg;
}

/** Ciężary rekordowe kolejnych sesji ćwiczenia (od najstarszej), tylko sesje z ciężarem — dane do wykresu. */
export function bestKgSeries(entries: readonly TrainingEntry[], exerciseId: string): number[] {
  return [...entries]
    .filter((e) => e.exerciseId === exerciseId)
    .sort(byTrainingTime)
    .map((e) => bestKg(e.sets))
    .filter((kg): kg is number => kg !== undefined);
}

/** Ciężar: liczba ≥ 0 do 500 kg, zaokrąglona do pół kilo; inaczej `undefined`. */
export function cleanKg(v: unknown): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > TRAINING_KG_MAX) return undefined;
  return Math.round(v * 2) / 2;
}

/** Seria: powtórki całkowite 1–100, ciężar opcjonalny. Zła seria = `null`. */
export function cleanSet(raw: unknown): TrainingSet | null {
  const s = raw as Partial<TrainingSet> | null;
  if (!s || typeof s !== "object") return null;
  if (typeof s.reps !== "number" || !Number.isInteger(s.reps) || s.reps < 1 || s.reps > TRAINING_REPS_MAX) return null;
  const kg = cleanKg(s.kg);
  return kg !== undefined ? { reps: s.reps, kg } : { reps: s.reps };
}

/** Wpis treningu: znane ćwiczenie i od 1 do 30 poprawnych serii. Zły wpis = `null`. */
export function cleanEntry(raw: unknown): TrainingEntry | null {
  const e = raw as Partial<TrainingEntry> | null;
  if (!e || typeof e !== "object") return null;
  if (typeof e.id !== "string" || !e.id || e.id.length > 64) return null;
  if (typeof e.day !== "string" || !DAY_RE.test(e.day)) return null;
  if (!isKnownExercise(e.exerciseId)) return null;
  const sets = (Array.isArray(e.sets) ? e.sets : []).map(cleanSet).filter((s): s is TrainingSet => !!s).slice(0, TRAINING_MAX_SETS);
  if (sets.length === 0) return null;
  const time = typeof e.time === "string" && TIME_RE.test(e.time) ? e.time : undefined;
  return {
    id: e.id,
    day: e.day,
    exerciseId: e.exerciseId,
    sets,
    note: typeof e.note === "string" ? e.note.trim().slice(0, TRAINING_NOTE_MAX) : "",
    created: typeof e.created === "number" && Number.isFinite(e.created) ? e.created : 0,
    ...(time ? { time } : {}),
  };
}

/** Plan dnia: nazwa, 1–12 znanych ćwiczeń, cel serii i powtórek. Zły plan = `null`. */
export function cleanPlanDay(raw: unknown): PlanDay | null {
  const p = raw as Partial<PlanDay> | null;
  if (!p || typeof p !== "object") return null;
  if (typeof p.id !== "string" || !p.id || p.id.length > 64) return null;
  if (typeof p.name !== "string" || !p.name.trim()) return null;
  const exerciseIds = (Array.isArray(p.exerciseIds) ? p.exerciseIds : []).filter(isKnownExercise).slice(0, PLAN_MAX_EXERCISES);
  if (exerciseIds.length === 0) return null;
  const targetSets = typeof p.targetSets === "number" && Number.isInteger(p.targetSets) && p.targetSets >= 1 && p.targetSets <= 10 ? p.targetSets : 3;
  const targetReps = typeof p.targetReps === "number" && Number.isInteger(p.targetReps) && p.targetReps >= 1 && p.targetReps <= TRAINING_REPS_MAX ? p.targetReps : 10;
  return {
    id: p.id,
    name: p.name.trim().slice(0, PLAN_NAME_MAX),
    exerciseIds,
    targetSets,
    targetReps,
    created: typeof p.created === "number" && Number.isFinite(p.created) ? p.created : 0,
  };
}

/** Najcięższa seria z ciężarem w danym wpisie; brak ciężaru = `undefined`. */
export function bestKg(sets: readonly TrainingSet[]): number | undefined {
  let best: number | undefined;
  for (const s of sets) if (s.kg !== undefined && (best === undefined || s.kg > best)) best = s.kg;
  return best;
}

/** Objętość treningu: suma powtórek × ciężar (serie bez ciężaru się nie liczą). */
export function volumeOf(sets: readonly TrainingSet[]): number {
  return sets.reduce((sum, s) => sum + (s.kg !== undefined ? s.reps * s.kg : 0), 0);
}

/** Kolejność chronologiczna: dzień, potem godzina, potem czas dodania. */
export function byTrainingTime(a: TrainingEntry, b: TrainingEntry): number {
  if (a.day !== b.day) return a.day < b.day ? -1 : 1;
  if (a.time && b.time && a.time !== b.time) return a.time < b.time ? -1 : 1;
  return a.created - b.created;
}

export interface ExerciseProgress {
  exerciseId: string;
  /** Najcięższa seria w całej historii. */
  bestKg?: number;
  bestDay?: string;
  /** Ostatnia sesja tego ćwiczenia. */
  lastEntry: TrainingEntry;
  sessions: number;
}

/** Progres per ćwiczenie: rekord ciężaru (z dniem), ostatnia sesja i liczba sesji. */
export function progressByExercise(entries: readonly TrainingEntry[]): Map<string, ExerciseProgress> {
  const out = new Map<string, ExerciseProgress>();
  for (const e of [...entries].sort(byTrainingTime)) {
    const prev = out.get(e.exerciseId);
    const kg = bestKg(e.sets);
    const better = kg !== undefined && (prev?.bestKg === undefined || kg > prev.bestKg);
    out.set(e.exerciseId, {
      exerciseId: e.exerciseId,
      bestKg: better ? kg : prev?.bestKg,
      bestDay: better ? e.day : prev?.bestDay,
      lastEntry: e,
      sessions: (prev?.sessions ?? 0) + 1,
    });
  }
  return out;
}

/** Plan: nazwa dnia i cel w jednej linii, np. „Klatka i triceps · 3 × 10”. */
export function planLine(p: PlanDay): string {
  return `${p.name} · ${p.targetSets} × ${p.targetReps}`;
}
