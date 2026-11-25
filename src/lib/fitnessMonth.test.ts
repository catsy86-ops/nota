import { describe, expect, it } from "vitest";
import { monthFitness, monthFitnessText } from "./fitnessMonth";
import type { TrainingEntry } from "@/lib/training/model";
import type { Meal } from "@/lib/diet/model";

const t = (id: string, day: string, kg: number, exerciseId = "bench"): TrainingEntry => ({ id, day, exerciseId, sets: [{ reps: 8, kg }], note: "", created: Number(id) });

describe("monthFitness (C3.3)", () => {
  it("dni treningu, rekordy względem całej historii, średnie z dni z wpisami, masa od–do", () => {
    const training = [t("1", "2026-10-30", 50), t("2", "2026-11-03", 52), t("3", "2026-11-03", 40, "squat"), t("4", "2026-11-10", 51), t("5", "2026-11-12", 55)];
    const meals = [
      { id: "a", day: "2026-11-03", text: "x", kcal: 2000, protein: 100, created: 1 },
      { id: "b", day: "2026-11-03", text: "y", kcal: 400, created: 2 },
      { id: "c", day: "2026-11-04", text: "z", kcal: 2000, created: 3 },
      { id: "d", day: "2026-10-31", text: "poza", kcal: 9000, created: 4 },
    ] as Meal[];
    const weights = [{ day: "2026-11-28", kg: 79.8, created: 2 }, { day: "2026-11-02", kg: 80.6, created: 1 }, { day: "2026-10-01", kg: 85, created: 0 }];
    const m = monthFitness(training, meals, weights, "2026-11");
    // squat 40 to pierwszy zapis (bez rekordu); bench: 52 > 50 i 55 > 52 → 2 rekordy; 51 nie.
    expect(m).toEqual({ month: "2026-11", trainingDays: 3, records: 2, avgKcal: 2200, avgProtein: 100, dietDays: 2, weightFrom: 80.6, weightTo: 79.8 });
    expect(monthFitnessText(m)).toBe([
      "Ćwiczenia — listopad 2026", "Treningi: 3 dni", "Nowe rekordy: 2",
      "Średnio dziennie: 2200 kcal, 100 g białka (2 dni z wpisami)", "Masa: 80,6 → 79,8 kg (−0,8 kg)",
    ].join("\n"));
  });

  it("pusty miesiąc: same treningi „0 dni”, bez reszty", () => {
    const m = monthFitness([], [], [], "2026-12");
    expect(monthFitnessText(m)).toBe("Ćwiczenia — grudzień 2026\nTreningi: 0 dni");
  });
});
