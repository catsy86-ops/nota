import { afterEach, describe, expect, it } from "vitest";
import { allExercises, cleanCustomExercise, exerciseById, isKnownExercise, setCustomExercises, CUSTOM_PREFIX, EXERCISES, type Exercise } from "./catalog";

const custom: Exercise = { id: `${CUSTOM_PREFIX}abc12345`, name: "Pompki na poręczach", group: "triceps", equipment: ["hantle"], hint: "Łokcie blisko ciała." };

afterEach(() => setCustomExercises([]));

describe("cleanCustomExercise", () => {
  it("przycina nazwę i odrzuca id bez prefiksu", () => {
    expect(cleanCustomExercise({ ...custom, name: "  Pompki   na  poręczach  " })?.name).toBe("Pompki na poręczach");
    expect(cleanCustomExercise({ ...custom, id: "klatka-hantle-plasko" })).toBeNull();
  });

  it("odrzuca pustą nazwę i nieznaną partię; filtruje sprzęt", () => {
    expect(cleanCustomExercise({ ...custom, name: "   " })).toBeNull();
    expect(cleanCustomExercise({ ...custom, group: "plecy" })).toBeNull();
    expect(cleanCustomExercise({ ...custom, equipment: ["hantle", "sztanga", "hantle"] as never })?.equipment).toEqual(["hantle"]);
  });
});

describe("rejestr własnych ćwiczeń", () => {
  it("własne ćwiczenie jest znane po ustawieniu rejestru, a po wyczyszczeniu znika", () => {
    expect(isKnownExercise(custom.id)).toBe(false);
    setCustomExercises([custom]);
    expect(isKnownExercise(custom.id)).toBe(true);
    expect(exerciseById(custom.id)?.name).toBe("Pompki na poręczach");
    expect(allExercises().map((e) => e.id)).toEqual([...EXERCISES.map((e) => e.id), custom.id]);
    setCustomExercises([]);
    expect(isKnownExercise(custom.id)).toBe(false);
  });

  it("stałe ćwiczenia zostają, nawet gdy rejestr przychodzi pusty albo z obcym id", () => {
    setCustomExercises([{ ...EXERCISES[0], id: "klatka-hantle-plasko" }]);
    expect(isKnownExercise(EXERCISES[0].id)).toBe(true);
    expect(allExercises()).toHaveLength(EXERCISES.length);
  });
});
