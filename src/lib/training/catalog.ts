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

const BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));

export function exerciseById(id: string): Exercise | undefined {
  return BY_ID.get(id);
}

/** Czy id jest w katalogu — zapis i odczyt dziennika odrzucają obce id. */
export function isKnownExercise(id: unknown): id is string {
  return typeof id === "string" && BY_ID.has(id);
}
