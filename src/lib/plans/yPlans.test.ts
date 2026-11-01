import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createYPlans } from "./yPlans";
import { planRefsIn } from "./planRefs";
import { PLAN_PROJECTS_MAX, type AnalysisProject, type PipeRoute } from "./model";

const H = (c: string) => c.repeat(64);
const project = (id: string, over: Partial<AnalysisProject> = {}): AnalysisProject => ({
  id, name: `Plan ${id}`, image: { ref: H("a"), type: "image/png", size: 1000, w: 2000, h: 1000 }, status: "draft", createdAt: 1, updatedAt: 1, ...over,
});
const route = (id: string, at = 1, over: Partial<PipeRoute> = {}): PipeRoute => ({ id, system: "cold", pts: [0, 0, 100, 0], source: "manual", verified: true, at, ...over });

function pair() {
  const docA = new Y.Doc(), docB = new Y.Doc();
  const sync = () => {
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA, Y.encodeStateVector(docB)));
    Y.applyUpdate(docA, Y.encodeStateAsUpdate(docB, Y.encodeStateVector(docA)));
  };
  return { a: createYPlans(docA), b: createYPlans(docB), docA, docB, sync };
}

describe("analizy planów w Yjs", () => {
  it("trasy dodane na dwóch urządzeniach scalają się; kalibracja i nazwa nie nadpisują się nawzajem", () => {
    const { a, b, sync } = pair();
    a.createProject(project("p1"));
    sync();
    a.save("r", "p1", route("r-a", 2));
    b.save("r", "p1", route("r-b", 3));
    b.updateProject("p1", { name: "Parter" }, 5);
    a.setCalibration("p1", { a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, meters: 2, at: 4 });
    sync();
    for (const side of [a, b]) {
      const d = side.get("p1")!;
      expect(d.routes.map((r) => r.id)).toEqual(["r-a", "r-b"]);
      expect(d.project.name).toBe("Parter");
      expect(d.calibration?.meters).toBe(2);
    }
  });

  it("encje usuniętej analizy (sieroty z drugiego urządzenia) nie są pokazywane", () => {
    const { a, b, sync } = pair();
    a.createProject(project("p1"));
    sync();
    a.removeProject("p1");
    b.save("r", "p1", route("r-late"));
    sync();
    expect(a.get("p1")).toBeNull();
    expect(a.list()).toEqual([]);
  });

  it("usunięcie i „Cofnij” przywraca analizę ze wszystkim", () => {
    const { a } = pair();
    a.createProject(project("p1"));
    a.save("r", "p1", route("r1"));
    a.save("s", "p1", { id: "s1", type: "valve", x: 5, y: 5, manual: true, verified: true, at: 2 });
    a.setCalibration("p1", { a: { x: 0, y: 0 }, b: { x: 50, y: 0 }, meters: 1, at: 3 });
    const removed = a.removeProject("p1")!;
    expect(a.get("p1")).toBeNull();
    a.restore(removed);
    const d = a.get("p1")!;
    expect([d.routes.length, d.symbols.length, d.calibration?.meters]).toEqual([1, 1, 1]);
  });

  it("odrzuca śmieci i trzyma limity", () => {
    const { a } = pair();
    expect(a.createProject({ ...project("p1"), image: { ref: "https://zly.example/x.png" } } as unknown as AnalysisProject)).toBe(false);
    a.createProject(project("p1"));
    expect(a.save("r", "p1", { ...route("r1"), pts: [0, 0] })).toBe(false);
    expect(a.save("r", "p1", { ...route("r1"), pts: [0, 0, Number.NaN, 1] })).toBe(false);
    expect(a.save("r", "nie-ma", route("r1"))).toBe(false);
    for (let i = 2; i <= PLAN_PROJECTS_MAX; i++) a.createProject(project(`p${i}`));
    expect(a.createProject(project("p-za-duzo"))).toBe(false);
  });

  it("kopia: dump i scalanie bez nadpisywania istniejących", () => {
    const { a, b } = pair();
    a.createProject(project("p1"));
    a.save("r", "p1", route("r1"));
    b.createProject(project("p1", { name: "Moja nazwa" }));
    b.mergeDump(a.dump());
    const d = b.get("p1")!;
    expect(d.project.name).toBe("Moja nazwa");
    expect(d.routes.map((r) => r.id)).toEqual(["r1"]);
    b.mergeDump({ entries: { "p\u0001zly id!": project("x") } });
    expect(b.list()).toHaveLength(1);
  });

  it("klucze obrazów: oryginał i kopia robocza dla sprzątania; do synchronizacji duży oryginał zostaje", () => {
    const { a, docA } = pair();
    a.createProject(project("maly"));
    a.createProject(project("duzy", { image: { ref: H("b"), type: "image/png", size: 9_000_000, w: 8000, h: 4000 }, work: { ref: H("c"), type: "image/png", size: 1_500_000, w: 4096, h: 2048 } }));
    expect(planRefsIn(docA)).toEqual(new Set([H("a"), H("b"), H("c")]));
    expect(planRefsIn(docA, true)).toEqual(new Set([H("a"), H("c")]));
  });

  it("„Cofnij” i „Ponów” cofają zapis trasy i kalibracji, a scalanie kopii nie trafia na stos", () => {
    const { a } = pair();
    a.createProject(project("p1"));
    a.history.clear();
    a.save("r", "p1", route("r1"));
    a.history.stop();
    a.setCalibration("p1", { a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, meters: 1, at: 2 });
    a.history.undo();
    expect(a.get("p1")!.calibration).toBeNull();
    expect(a.get("p1")!.routes).toHaveLength(1);
    a.history.undo();
    expect(a.get("p1")!.routes).toHaveLength(0);
    a.history.redo();
    expect(a.get("p1")!.routes).toHaveLength(1);
    a.history.clear();
    a.mergeDump({ entries: { "r\u0001p1\u0001r9": route("r9") } });
    expect(a.get("p1")!.routes).toHaveLength(2);
    expect(a.history.canUndo()).toBe(false);
  });
});
