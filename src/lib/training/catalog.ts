/**
 * Katalog ćwiczeń startowych: klatka, biceps, triceps — z ławeczką i hantlami (sprzęt w domu).
 * Treść statyczna w kodzie (jak materiał Nauki); dziennik i plany odwołują się do `id`.
 */

export type MuscleGroup = "klatka" | "biceps" | "triceps";
export type Equipment = "ławka" | "hantle";

export interface Exercise {
  id: string;
  name: string;
  group: MuscleGroup;
  equipment: Equipment[];
  /** Krótka wskazówka wykonania — treść, którą sprawdza właściciel. */
  hint: string;
}

export const MUSCLE_GROUPS: MuscleGroup[] = ["klatka", "biceps", "triceps"];

export const EXERCISES: Exercise[] = [
  { id: "klatka-hantle-plasko", name: "Wyciskanie hantli na płaskiej ławce", group: "klatka", equipment: ["ławka", "hantle"], hint: "Łopatki ściągnięte, hantle na wysokości klatki." },
  { id: "klatka-hantle-skos", name: "Wyciskanie hantli na skosie dodatnim", group: "klatka", equipment: ["ławka", "hantle"], hint: "Ławka pod kątem ok. 30°, ruch po łuku w górę." },
  { id: "klatka-rozpietki", name: "Rozpiętki z hantlami na płaskiej ławce", group: "klatka", equipment: ["ławka", "hantle"], hint: "Lekko ugięte łokcie, ruch jak przy przytulaniu." },
  { id: "biceps-uginanie", name: "Uginanie ramion ze sztangielkami", group: "biceps", equipment: ["hantle"], hint: "Łokcie przy tułowiu, bez bujania się." },
  { id: "biceps-mlotkowe", name: "Uginanie młotkowe", group: "biceps", equipment: ["hantle"], hint: "Kciuki do góry, nadgarstki proste." },
  { id: "biceps-skos", name: "Uginanie na ławce skośnej", group: "biceps", equipment: ["ławka", "hantle"], hint: "Ramiona zwisają za tułowiem, pełne rozciągnięcie." },
  { id: "triceps-nad-glowa", name: "Wyprost ramion z hantlem nad głową", group: "triceps", equipment: ["hantle"], hint: "Łokcie wąsko, ruch tylko w łokciu." },
  { id: "triceps-w-opadzie", name: "Wyprost ramion w opadzie tułowia", group: "triceps", equipment: ["hantle"], hint: "Tułów prawie równolegle do podłogi, łokieć blisko ciała." },
  { id: "triceps-francuski", name: "Prostowanie ramion leżąc na ławce", group: "triceps", equipment: ["ławka", "hantle"], hint: "Tylko przedramiona się ruszają, łokcie wskazują w górę." },
];

/**
 * Własne ćwiczenia (Yjs `trainingExercises`) dokładane do katalogu. Rejestr ustawia `setCustomExercises`
 * przy każdej zmianie mapy, więc `isKnownExercise` zna je przed odczytem dziennika i planów.
 */
export const CUSTOM_PREFIX = "wlasne-";
export const CUSTOM_MAX = 30;
export const CUSTOM_NAME_MAX = 40;
export const CUSTOM_HINT_MAX = 120;
const EQUIPMENT: Equipment[] = ["ławka", "hantle"];

let custom: Exercise[] = [];
let BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));

/** Ustawia listę własnych ćwiczeń (już oczyszczoną) i przebudowuje rejestr. Stałe ćwiczenia zostają. */
export function setCustomExercises(list: readonly Exercise[]): void {
  custom = list.filter((e) => e.id.startsWith(CUSTOM_PREFIX)).slice(0, CUSTOM_MAX);
  BY_ID = new Map([...EXERCISES, ...custom].map((e) => [e.id, e]));
}

export function customExercises(): Exercise[] {
  return custom;
}

/** Katalog stały i własne razem, w kolejności: najpierw stałe. */
export function allExercises(): Exercise[] {
  return [...EXERCISES, ...custom];
}

/** Dowolne wejście (kopia, inne urządzenie) → poprawne własne ćwiczenie albo `null`. */
export function cleanCustomExercise(raw: unknown): Exercise | null {
  const e = raw as Partial<Exercise> | null;
  if (!e || typeof e !== "object") return null;
  if (typeof e.id !== "string" || !e.id.startsWith(CUSTOM_PREFIX) || e.id.length > 64) return null;
  const name = typeof e.name === "string" ? e.name.replace(/\s+/g, " ").trim().slice(0, CUSTOM_NAME_MAX) : "";
  if (!name) return null;
  if (!MUSCLE_GROUPS.includes(e.group as MuscleGroup)) return null;
  const equipment = Array.isArray(e.equipment) ? e.equipment.filter((x): x is Equipment => EQUIPMENT.includes(x as Equipment)) : [];
  const hint = typeof e.hint === "string" ? e.hint.trim().slice(0, CUSTOM_HINT_MAX) : "";
  return { id: e.id, name, group: e.group as MuscleGroup, equipment: [...new Set(equipment)], hint };
}

export function exerciseById(id: string): Exercise | undefined {
  return BY_ID.get(id);
}

/** Czy id jest w katalogu albo wśród własnych — zapis i odczyt dziennika odrzucają obce id. */
export function isKnownExercise(id: unknown): id is string {
  return typeof id === "string" && BY_ID.has(id);
}
