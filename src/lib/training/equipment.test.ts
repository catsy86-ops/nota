import { describe, it, expect } from "vitest";
import { bestKgSeries, cleanEquipment, overDumbbell, type TrainingEntry } from "./model";

const entry = (id: string, day: string, exerciseId: string, kg: number): TrainingEntry =>
  ({ id, day, exerciseId, sets: [{ reps: 10, kg }], note: "", created: 1 }) as TrainingEntry;

describe("cleanEquipment", () => {
  it("zostawia dodatni limit hantli; zero, ujemne i śmieci = brak", () => {
    expect(cleanEquipment({ dumbbellMaxKg: 24 })).toEqual({ dumbbellMaxKg: 24 });
    expect(cleanEquipment({ dumbbellMaxKg: 0 })).toEqual({});
    expect(cleanEquipment({ dumbbellMaxKg: -5 })).toEqual({});
    expect(cleanEquipment({ dumbbellMaxKg: "dużo" })).toEqual({});
    expect(cleanEquipment(null)).toEqual({});
  });
});

describe("overDumbbell", () => {
  it("ostrzega tylko dla ćwiczeń z hantlami i znanego limitu", () => {
    expect(overDumbbell(26, ["ławka", "hantle"], { dumbbellMaxKg: 20 })).toBe(true);
    expect(overDumbbell(20, ["ławka", "hantle"], { dumbbellMaxKg: 20 })).toBe(false);
    expect(overDumbbell(100, ["ławka"], { dumbbellMaxKg: 20 })).toBe(false);
    expect(overDumbbell(100, ["hantle"], {})).toBe(false);
    expect(overDumbbell(undefined, ["hantle"], { dumbbellMaxKg: 20 })).toBe(false);
  });
});

describe("bestKgSeries", () => {
  it("rekordy kolejnych sesji tego ćwiczenia, od najstarszej, bez sesji bez ciężaru", () => {
    const list = [
      entry("c", "2026-10-20", "klatka-hantle-plasko", 24),
      entry("x", "2026-10-12", "biceps-mlotkowe", 14),
      entry("a", "2026-10-10", "klatka-hantle-plasko", 20),
      { id: "b", day: "2026-10-15", exerciseId: "klatka-hantle-plasko", sets: [{ reps: 10 }], note: "", created: 1 } as TrainingEntry,
    ];
    expect(bestKgSeries(list, "klatka-hantle-plasko")).toEqual([20, 24]);
  });
});
