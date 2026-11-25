import { describe, expect, it } from "vitest";
import { mealsCsv, trainingCsv, weightsCsv } from "./fitnessCsv";
import type { TrainingEntry } from "@/lib/training/model";
import type { Meal } from "@/lib/diet/model";

const lines = (csv: string) => csv.replace("﻿", "").trimEnd().split("\r\n");

describe("fitnessCsv (C3.5)", () => {
  it("trening: seria na wiersz, od najstarszego, notatka przy pierwszej serii, seria na czas w sekundach", () => {
    const entries: TrainingEntry[] = [
      { id: "b", day: "2026-11-02", time: "18:00", exerciseId: "deska", sets: [{ reps: 1, seconds: 60 }], note: "", created: 2 },
      { id: "a", day: "2026-11-01", exerciseId: "bench", sets: [{ reps: 10, kg: 40.5 }, { reps: 8, kg: 40.5 }], note: "=ciężko", created: 1 },
    ];
    expect(lines(trainingCsv(entries, (id) => (id === "bench" ? "Wyciskanie" : undefined)))).toEqual([
      "Data;Godzina;Ćwiczenie;Seria;Powtórzenia;Sekundy;Ciężar [kg];Notatka",
      "2026-11-01;;Wyciskanie;1;10;;40,5;'=ciężko",
      "2026-11-01;;Wyciskanie;2;8;;40,5;",
      "2026-11-02;18:00;deska;1;;60;;",
    ]);
  });

  it("posiłki i masa: od najstarszego, puste pola przy brakach", () => {
    const meals = [
      { id: "2", day: "2026-11-02", text: "kanapka; kawa", kcal: 450, created: 2 },
      { id: "1", day: "2026-11-01", time: "08:00", text: "owsianka", kcal: 380, protein: 12.5, created: 1 },
    ] as Meal[];
    expect(lines(mealsCsv(meals))).toEqual(["Data;Godzina;Posiłek;Kalorie [kcal];Białko [g]", "2026-11-01;08:00;owsianka;380;12,5", '2026-11-02;;"kanapka; kawa";450;']);
    expect(lines(weightsCsv([{ day: "2026-11-02", kg: 80.2, created: 2 }, { day: "2026-11-01", kg: 80.6, created: 1 }]))).toEqual(["Data;Masa [kg]", "2026-11-01;80,6", "2026-11-02;80,2"]);
  });
});
