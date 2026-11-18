import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createYTraining } from "@/lib/training/yTraining";
import { EXERCISES } from "@/lib/training/catalog";
import { createYWeight } from "@/lib/weight/yWeight";
import { createYDiet } from "@/lib/diet/yDiet";
import { mergeStored } from "@/lib/extraFields";

// D1.1 (`docs/plan-migracje-yjs-2026-11-15.md`): pola nowszej wersji w Ćwiczeniach przeżywają „Cofnij”, kopię
// i nadpisanie wpisu na tej wersji. Pole przyszłości: `xFuture`.

const json = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

describe("D1.1 Ćwiczenia: nieznane pola", () => {
  it("plan dnia: „Cofnij” po usunięciu i kopia", () => {
    const doc = new Y.Doc();
    doc.getMap("trainingPlans").set("p1", { id: "p1", name: "Pchanie", exerciseIds: [EXERCISES[0].id], targetSets: 3, targetReps: 10, created: 1, xFuture: "tak" });
    const y = createYTraining(doc);
    y.restorePlan(y.removePlan("p1")!);
    expect(doc.getMap("trainingPlans").get("p1")).toMatchObject({ xFuture: "tak" });
    const dump = json(y.dump());
    expect(dump.plans[0]).toMatchObject({ xFuture: "tak" });
    expect(dump.plans[0]).not.toHaveProperty("extra");
    const other = createYTraining(new Y.Doc());
    other.mergeDump(dump);
    expect(other.getPlans()[0].extra).toEqual({ xFuture: "tak" });
  });

  it("waga: ponowne ważenie tego dnia na tej wersji nie gubi pola; kopia też", () => {
    const doc = new Y.Doc();
    doc.getMap("weightEntries").set("2026-11-18", { day: "2026-11-18", kg: 80, created: 1, xFuture: 3 });
    const y = createYWeight(doc);
    expect(y.set({ day: "2026-11-18", kg: 79.5, created: 2 })).toBe(true);
    expect(doc.getMap("weightEntries").get("2026-11-18")).toEqual({ day: "2026-11-18", kg: 79.5, created: 2, xFuture: 3 });
    const dump = json(y.dump());
    expect(dump[0]).toEqual({ day: "2026-11-18", kg: 79.5, created: 2, xFuture: 3 });
  });

  it("dieta: posiłek po „Cofnij”, cele nadpisane z formularza, kopia", () => {
    const doc = new Y.Doc();
    doc.getMap("dietMeals").set("m1", { id: "m1", day: "2026-11-18", text: "owsianka", created: 1, xFuture: true });
    doc.getMap("dietMeta").set("goals", { kcal: 2000, xFuture: "x" });
    const y = createYDiet(doc);
    y.restore(y.remove("m1")!);
    expect(doc.getMap("dietMeals").get("m1")).toMatchObject({ xFuture: true });
    y.setGoals({ kcal: 2200, protein: 120 });
    expect(doc.getMap("dietMeta").get("goals")).toEqual({ kcal: 2200, protein: 120, xFuture: "x" });
    const dump = json(y.dump());
    expect(dump.meals[0]).toMatchObject({ xFuture: true });
    expect(dump.goals).toEqual({ kcal: 2200, protein: 120, xFuture: "x" });
  });

  it("mergeStored: nowe pola wygrywają, limity jak w pickExtra, bez klucza extra", () => {
    const next: { a: number; extra?: Record<string, unknown> } = { a: 1, extra: { y: 2 } };
    const out = mergeStored(next, { a: 0, x: 1, y: 1, __proto__x: 5, big: "z".repeat(500) }, ["a"]);
    expect(out).toEqual({ a: 1, x: 1, y: 2 });
    const plain: { a: number; extra?: Record<string, unknown> } = { a: 1 };
    expect(mergeStored(plain, null, ["a"])).toEqual({ a: 1 });
  });
});
