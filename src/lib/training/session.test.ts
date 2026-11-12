import { describe, expect, it } from "vitest";
import { afterLogged, afterSkipped, currentExerciseId, isFinished, sessionMinutes, startSession } from "./session";

const plan = { name: "Klatka i triceps", exerciseIds: ["a", "b", "c"], targetSets: 3, targetReps: 10 };

describe("prowadzony trening", () => {
  it("pusty plan nie startuje; start ustawia pierwsze ćwiczenie", () => {
    expect(startSession({ ...plan, exerciseIds: [] }, 0)).toBeNull();
    const s = startSession(plan, 1000)!;
    expect(currentExerciseId(s)).toBe("a");
    expect(isFinished(s)).toBe(false);
  });

  it("zapis i pominięcie przesuwają kolejkę; podsumowanie sumuje objętość i rekordy", () => {
    let s = startSession(plan, 0)!;
    s = afterLogged(s, 600, true);
    expect(currentExerciseId(s)).toBe("b");
    s = afterSkipped(s);
    s = afterLogged(s, 400, false);
    expect(isFinished(s)).toBe(true);
    expect(s).toMatchObject({ logged: 2, skipped: 1, volume: 1000, records: 1 });
    expect(afterSkipped(s)).toBe(s);
    expect(currentExerciseId(s)).toBeUndefined();
  });

  it("czas: pełne minuty, nie mniej niż 1", () => {
    const s = startSession(plan, 0)!;
    expect(sessionMinutes(s, 10_000)).toBe(1);
    expect(sessionMinutes(s, 25 * 60_000)).toBe(25);
  });
});
