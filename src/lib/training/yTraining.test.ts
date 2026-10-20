import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { createYTraining, TRAINING_ORIGIN } from "./yTraining";
import type { PlanDay, TrainingEntry } from "./model";

const entry = (id: string, over: Partial<TrainingEntry> = {}): TrainingEntry =>
  ({ id, day: "2026-10-20", exerciseId: "klatka-rozpietki", sets: [{ reps: 10, kg: 12 }], note: "", created: 1, ...over });
const plan = (id: string): PlanDay => ({ id, name: "Klatka", exerciseIds: ["klatka-rozpietki"], targetSets: 3, targetReps: 10, created: 1 });

describe("createYTraining", () => {
  it("dodaje wpis i zwraca go w kolejności", () => {
    const y = createYTraining(new Y.Doc());
    y.addEntry(entry("b", { time: "20:00" }));
    y.addEntry(entry("a", { time: "07:00" }));
    expect(y.getEntries().map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("usunięcie i cofnięcie zachowują wpis", () => {
    const y = createYTraining(new Y.Doc());
    y.addEntry(entry("a"));
    const prev = y.removeEntry("a");
    expect(y.getEntries()).toEqual([]);
    y.restoreEntry(prev!);
    expect(y.getEntries()[0].id).toBe("a");
  });

  it("plany: dodawanie, usuwanie bez ruszania dziennika", () => {
    const y = createYTraining(new Y.Doc());
    y.addEntry(entry("a"));
    y.addPlan(plan("p1"));
    expect(y.getPlans()).toHaveLength(1);
    y.removePlan("p1");
    expect(y.getPlans()).toEqual([]);
    expect(y.getEntries()).toHaveLength(1);
  });

  it("zmiany idą z origin Treningu", () => {
    const doc = new Y.Doc();
    const y = createYTraining(doc);
    const origins: unknown[] = [];
    doc.on("afterTransaction", (tr: Y.Transaction) => origins.push(tr.origin));
    y.addEntry(entry("a"));
    expect(origins).toContain(TRAINING_ORIGIN);
  });

  it("scalanie z kopii dodaje brakujące wpisy i plany, nic nie kasuje; śmieci odpadają", () => {
    const y = createYTraining(new Y.Doc());
    y.addEntry(entry("lokalny"));
    y.mergeDump({ entries: [entry("z-kopii"), { id: "zepsuty", day: "zle" }], plans: [plan("p-kopia")] });
    expect(y.getEntries().map((e) => e.id).sort()).toEqual(["lokalny", "z-kopii"]);
    expect(y.getPlans().map((p) => p.id)).toEqual(["p-kopia"]);
  });
});
