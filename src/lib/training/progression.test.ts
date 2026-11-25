import { describe, expect, it } from "vitest";
import { progressionText, suggestNext, targetRepsFor, warmupSets, warmupText } from "./progression";
import type { PlanDay, TrainingEntry, TrainingSet } from "./model";

const entry = (id: string, day: string, sets: TrainingSet[], exerciseId = "bench"): TrainingEntry => ({ id, day, exerciseId, sets, note: "", created: Number(id) });
const s = (reps: number, kg?: number, seconds?: number): TrainingSet => ({ reps, ...(kg !== undefined ? { kg } : {}), ...(seconds !== undefined ? { seconds } : {}) });

describe("suggestNext (C2.1)", () => {
  it("wszystkie serie na celu → dołóż 1 kg (od 10 kg), poniżej 10 kg — 0,5 kg; liczy się ostatnia sesja", () => {
    const old = entry("1", "2026-11-01", [s(6, 40), s(6, 40)]);
    const lastOk = entry("2", "2026-11-03", [s(10, 40), s(10, 40), s(11, 40)]);
    expect(suggestNext([lastOk, old], "bench", 10, [], {})).toEqual({ kind: "add", kg: 41, reps: 10 });
    expect(suggestNext([entry("3", "2026-11-03", [s(12, 8), s(12, 8)])], "bench", 12, [], {})).toEqual({ kind: "add", kg: 8.5, reps: 12 });
  });

  it("nie wszystkie serie na celu → te same kg, o powtórkę więcej od najsłabszej serii roboczej", () => {
    const e = entry("1", "2026-11-03", [s(10, 40), s(8, 40), s(9, 40)]);
    expect(suggestNext([e], "bench", 10, [], {})).toEqual({ kind: "reps", kg: 40, reps: 9, capped: false });
  });

  it("liczy tylko serie z największym ciężarem (lżejsze rozgrzewkowe nie psują wyniku)", () => {
    const e = entry("1", "2026-11-03", [s(10, 20), s(10, 40), s(10, 40)]);
    expect(suggestNext([e], "bench", 10, [], {})).toEqual({ kind: "add", kg: 41, reps: 10 });
  });

  it("limit hantli: zamiast dołożenia — powtórki, z oznaczeniem", () => {
    const e = entry("1", "2026-11-03", [s(12, 20), s(12, 20)]);
    expect(suggestNext([e], "bench", 12, ["hantle"], { dumbbellMaxKg: 20 })).toEqual({ kind: "reps", kg: 20, reps: 13, capped: true });
    expect(suggestNext([e], "bench", 12, ["sztanga"], { dumbbellMaxKg: 20 })).toEqual({ kind: "add", kg: 21, reps: 12 });
  });

  it("bez celu, bez historii, serie na czas albo bez ciężaru → null", () => {
    const e = entry("1", "2026-11-03", [s(10, 40)]);
    expect(suggestNext([e], "bench", undefined, [], {})).toBeNull();
    expect(suggestNext([], "bench", 10, [], {})).toBeNull();
    expect(suggestNext([e], "squat", 10, [], {})).toBeNull();
    expect(suggestNext([entry("2", "2026-11-03", [s(1, 10, 60)])], "bench", 10, [], {})).toBeNull();
    expect(suggestNext([entry("3", "2026-11-03", [s(15), s(15)])], "bench", 10, [], {})).toBeNull();
    expect(suggestNext([entry("4", "2026-11-03", [s(15, 10), s(15)])], "bench", 10, [], {})).toBeNull();
  });

  it("cel z sesji ma pierwszeństwo przed planem; tekst po polsku z przecinkiem", () => {
    const plans = [{ id: "p", name: "A", exerciseIds: ["bench"], targetSets: 3, targetReps: 8, created: 1 }] as PlanDay[];
    expect(targetRepsFor("bench", plans)).toBe(8);
    expect(targetRepsFor("bench", plans, 12)).toBe(12);
    expect(targetRepsFor("squat", plans)).toBeUndefined();
    expect(progressionText({ kind: "add", kg: 8.5, reps: 12 })).toBe("Dołóż: 8,5 kg × 12");
    expect(progressionText({ kind: "reps", kg: 40, reps: 9, capped: false })).toBe("Te same 40 kg, o powtórkę więcej: 9");
    expect(progressionText({ kind: "reps", kg: 20, reps: 13, capped: true })).toBe("Hantle już na maksimum — zostań przy 20 kg, celuj w 13 powtórzeń");
  });
});

describe("warmupSets (C2.4)", () => {
  it("50% i 75% ciężaru roboczego, w dół do 0,5 kg; poniżej 10 kg albo bez ciężaru — nic", () => {
    expect(warmupSets(41)).toEqual([{ kg: 20.5, reps: 8 }, { kg: 30.5, reps: 5 }]);
    expect(warmupText(warmupSets(60))).toBe("Rozgrzewka: 30 kg × 8, 45 kg × 5");
    expect(warmupSets(9.5)).toEqual([]);
    expect(warmupSets(undefined)).toEqual([]);
  });
});
