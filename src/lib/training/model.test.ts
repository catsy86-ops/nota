import { describe, it, expect } from "vitest";
import { EQUIPMENT_LIST, EXERCISES, exerciseById, isKnownExercise } from "./catalog";
import { bestKg, byTrainingTime, cleanEntry, cleanKg, cleanPlanDay, cleanSet, planLine, progressByExercise, volumeOf, type TrainingEntry } from "./model";

const entry = (id: string, day: string, exerciseId: string, sets: { reps: number; kg?: number }[], over: Partial<TrainingEntry> = {}): TrainingEntry =>
  ({ id, day, exerciseId, sets, note: "", created: 1, ...over }) as TrainingEntry;

describe("katalog", () => {
  it("ma ćwiczenia na klatkę, biceps i triceps z ławką lub hantlami, bez duplikatów id", () => {
    const groups = new Set(EXERCISES.map((e) => e.group));
    expect([...groups]).toEqual(expect.arrayContaining(["klatka", "biceps", "triceps"]));
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length);
    for (const e of EXERCISES) for (const eq of e.equipment) expect(EQUIPMENT_LIST).toContain(eq);
  });

  it("rozpoznaje znane i obce id", () => {
    expect(isKnownExercise("klatka-rozpietki")).toBe(true);
    expect(isKnownExercise("nie-ma-takiego")).toBe(false);
    expect(exerciseById("biceps-mlotkowe")?.name).toBe("Uginanie młotkowe");
  });
});

describe("cleanKg / cleanSet", () => {
  it("ciężar zaokrąglony do pół kilo, poza zakresem brak", () => {
    expect(cleanKg(12.3)).toBe(12.5);
    expect(cleanKg(-1)).toBeUndefined();
    expect(cleanKg(501)).toBeUndefined();
  });

  it("seria: powtórki całkowite 1–100; zła seria odpada", () => {
    expect(cleanSet({ reps: 10, kg: 20 })).toEqual({ reps: 10, kg: 20 });
    expect(cleanSet({ reps: 10.5 })).toBeNull();
    expect(cleanSet({ reps: 0 })).toBeNull();
    expect(cleanSet({ reps: 10, kg: "dużo" })).toEqual({ reps: 10 });
  });
});

describe("cleanEntry", () => {
  it("wpis z kilkoma seriami; obce ćwiczenie odrzuca cały wpis", () => {
    const ok = cleanEntry({ id: "t1", day: "2026-10-20", exerciseId: "klatka-rozpietki", sets: [{ reps: 10, kg: 12 }, { reps: 9 }], time: "19:00", created: 2 });
    expect(ok?.sets).toHaveLength(2);
    expect(ok?.time).toBe("19:00");
    expect(cleanEntry({ id: "t1", day: "2026-10-20", exerciseId: "zla", sets: [{ reps: 10 }] })).toBeNull();
  });

  it("wpis bez poprawnej serii odpada", () => {
    expect(cleanEntry({ id: "t1", day: "2026-10-20", exerciseId: "klatka-rozpietki", sets: [{ reps: 0 }] })).toBeNull();
  });

  it("serii jest co najwyżej 30", () => {
    const sets = Array.from({ length: 40 }, () => ({ reps: 8, kg: 10 }));
    expect(cleanEntry({ id: "t1", day: "2026-10-20", exerciseId: "klatka-rozpietki", sets })?.sets).toHaveLength(30);
  });
});

describe("cleanPlanDay", () => {
  it("plan z nazwą i znanymi ćwiczeniami; obce ćwiczenia są pomijane", () => {
    const p = cleanPlanDay({ id: "p1", name: "  Klatka  ", exerciseIds: ["klatka-rozpietki", "zla"], targetSets: 3, targetReps: 10, created: 1 });
    expect(p?.name).toBe("Klatka");
    expect(p?.exerciseIds).toEqual(["klatka-rozpietki"]);
    expect(planLine(p!)).toBe("Klatka · 3 × 10");
  });

  it("plan bez znanych ćwiczeń albo bez nazwy odpada", () => {
    expect(cleanPlanDay({ id: "p1", name: "X", exerciseIds: ["zla"] })).toBeNull();
    expect(cleanPlanDay({ id: "p1", name: " ", exerciseIds: ["klatka-rozpietki"] })).toBeNull();
  });
});

describe("liczenie", () => {
  it("rekord ciężaru i objętość", () => {
    expect(bestKg([{ reps: 10 }, { reps: 8, kg: 20 }, { reps: 6, kg: 22.5 }])).toBe(22.5);
    expect(bestKg([{ reps: 10 }])).toBeUndefined();
    expect(volumeOf([{ reps: 10, kg: 20 }, { reps: 8 }, { reps: 5, kg: 10 }])).toBe(250);
  });

  it("progres: rekord z dniem pochodzi z najcięższej serii, a nie z ostatniej sesji", () => {
    const list = [
      entry("a", "2026-10-10", "klatka-hantle-plasko", [{ reps: 10, kg: 20 }]),
      entry("b", "2026-10-15", "klatka-hantle-plasko", [{ reps: 8, kg: 24 }]),
      entry("c", "2026-10-20", "klatka-hantle-plasko", [{ reps: 10, kg: 22 }]),
    ];
    const p = progressByExercise(list).get("klatka-hantle-plasko");
    expect(p).toMatchObject({ bestKg: 24, bestDay: "2026-10-15", sessions: 3 });
    expect(p?.lastEntry.id).toBe("c");
  });

  it("chronologia: dzień, potem godzina", () => {
    const list = [entry("późno", "2026-10-20", "klatka-rozpietki", [{ reps: 1 }], { time: "21:00" }), entry("wcześnie", "2026-10-20", "klatka-rozpietki", [{ reps: 1 }], { time: "07:00" })];
    expect(list.sort(byTrainingTime).map((e) => e.id)).toEqual(["wcześnie", "późno"]);
  });
});
