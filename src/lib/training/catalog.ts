/**
 * Katalog ćwiczeń startowych (1.1): klatka, biceps, triceps z ławeczką i hantlami, a od 1.1 także plecy, barki, nogi,
 * pośladki, brzuch, przedramiona i całe ciało. Wskazówki nowych ćwiczeń to SZKIC do akceptacji właściciela (C-4)
 * przed wydaniem; nowe partie i sprzęt wymagają wcześniejszej aktualizacji wszystkich urządzeń (C-1).
 * Treść statyczna w kodzie (jak materiał Nauki); dziennik i plany odwołują się do `id`.
 */

export type MuscleGroup = "klatka" | "biceps" | "triceps" | "plecy" | "barki" | "nogi" | "posladki" | "brzuch" | "przedramiona" | "cale-cialo";
export type Equipment = "ławka" | "hantle" | "masa ciała" | "drążek" | "sztanga" | "gumy" | "maszyna" | "kettlebell";

export interface Exercise {
  id: string;
  name: string;
  group: MuscleGroup;
  equipment: Equipment[];
  /** Krótka wskazówka wykonania — treść, którą sprawdza właściciel. */
  hint: string;
}

export const MUSCLE_GROUPS: MuscleGroup[] = ["klatka", "biceps", "triceps", "plecy", "barki", "nogi", "posladki", "brzuch", "przedramiona", "cale-cialo"];

/** Etykiety partii do wyboru i nagłówków (ids zostają ASCII, jak w dzienniku i planach). */
export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  klatka: "Klatka",
  biceps: "Biceps",
  triceps: "Triceps",
  plecy: "Plecy",
  barki: "Barki",
  nogi: "Nogi",
  posladki: "Pośladki",
  brzuch: "Brzuch",
  przedramiona: "Przedramiona",
  "cale-cialo": "Całe ciało",
};

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
  // Szkic 1.1 (wskazówki do akceptacji właściciela, C-4).
  { id: "plecy-wiosla", name: "Wiosłowanie hantlem w opadzie", group: "plecy", equipment: ["hantle"], hint: "Plecy proste, łokieć ciągnie w stronę biodra." },
  { id: "plecy-podciaganie", name: "Podciąganie na drążku", group: "plecy", equipment: ["drążek", "masa ciała"], hint: "Pełny zwis na starcie, broda nad drążkiem." },
  { id: "plecy-martwy", name: "Martwy ciąg ze sztangą", group: "plecy", equipment: ["sztanga"], hint: "Sztanga blisko nóg, plecy w neutralnym ustawieniu." },
  { id: "barki-wyciskanie", name: "Wyciskanie hantli nad głowę", group: "barki", equipment: ["hantle"], hint: "Ruch pionowy, bez wyginania lędźwi." },
  { id: "barki-unoszenie", name: "Unoszenie hantli bokiem", group: "barki", equipment: ["hantle"], hint: "Lekko ugięte łokcie, unoszenie do wysokości barków." },
  { id: "barki-linka", name: "Ściąganie gumy do twarzy", group: "barki", equipment: ["gumy"], hint: "Łokcie na wysokości barków, ciągnij ku twarzy." },
  { id: "nogi-przysiad", name: "Przysiad ze sztangą", group: "nogi", equipment: ["sztanga"], hint: "Kolana w linii stóp, klatka piersiowa wyprostowana." },
  { id: "nogi-wykroki", name: "Wykroki z hantlami", group: "nogi", equipment: ["hantle"], hint: "Długi krok, kolano nad piętą." },
  { id: "nogi-wyprosty", name: "Wyprosty nóg na maszynie", group: "nogi", equipment: ["maszyna"], hint: "Pełny wyprost bez zatrzymywania w połowie." },
  { id: "posladki-most", name: "Unoszenie bioder (most)", group: "posladki", equipment: ["masa ciała"], hint: "Napnij pośladki w górze, nie przeciążaj lędźwi." },
  { id: "posladki-hip-thrust", name: "Hip thrust na ławce", group: "posladki", equipment: ["ławka", "sztanga"], hint: "Plecy oparte o ławkę, stopy płasko na podłodze." },
  { id: "posladki-swing", name: "Wymach kettlebell", group: "posladki", equipment: ["kettlebell"], hint: "Ruch z bioder, nie z ramion." },
  { id: "brzuch-deska", name: "Deska", group: "brzuch", equipment: ["masa ciała"], hint: "Ciało w linii, brzuch napięty." },
  { id: "brzuch-spiecia", name: "Spięcia brzucha", group: "brzuch", equipment: ["masa ciała"], hint: "Unoś łopatki, nie ciągnij szyi." },
  { id: "brzuch-skrety", name: "Skręty tułowia z gumą", group: "brzuch", equipment: ["gumy"], hint: "Ruch z tułowia, biodra spokojne." },
  { id: "przedramiona-zginanie", name: "Zginanie nadgarstka z hantlem", group: "przedramiona", equipment: ["hantle"], hint: "Ruch tylko w nadgarstku, przedramię oparte o kolano." },
  { id: "przedramiona-wyprost", name: "Wyprost nadgarstka z hantlem", group: "przedramiona", equipment: ["hantle"], hint: "Ruch tylko w nadgarstku, w dół powoli." },
  { id: "cialo-burpees", name: "Burpees", group: "cale-cialo", equipment: ["masa ciała"], hint: "Równe tempo, pełny zeskok i wyskok." },
  { id: "cialo-pompki", name: "Pompki", group: "cale-cialo", equipment: ["masa ciała"], hint: "Ciało w linii od głowy do pięt." },
  { id: "cialo-thruster", name: "Thruster ze sztangą", group: "cale-cialo", equipment: ["sztanga"], hint: "Przysiad i wyciśnięcie jednym ruchem." },
];

/**
 * Własne ćwiczenia (Yjs `trainingExercises`) dokładane do katalogu. Rejestr ustawia `setCustomExercises`
 * przy każdej zmianie mapy, więc `isKnownExercise` zna je przed odczytem dziennika i planów.
 */
export const CUSTOM_PREFIX = "wlasne-";
export const CUSTOM_MAX = 30;
export const CUSTOM_NAME_MAX = 40;
export const CUSTOM_HINT_MAX = 120;
/** Sprzęt do wyboru przy własnym ćwiczeniu i w katalogu. */
export const EQUIPMENT_LIST: Equipment[] = ["ławka", "hantle", "masa ciała", "drążek", "sztanga", "gumy", "maszyna", "kettlebell"];

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
  const equipment = Array.isArray(e.equipment) ? e.equipment.filter((x): x is Equipment => EQUIPMENT_LIST.includes(x as Equipment)) : [];
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
