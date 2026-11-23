import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createYPlans } from "@/lib/plans/yPlans";
import { createYStudy } from "@/lib/study/yStudy";
import type { AnalysisProject, PipeRoute } from "@/lib/plans/model";

// D1.1 (`docs/plan-migracje-yjs-2026-11-15.md`): pole nowszej wersji (`xFuture`) przeżywa zapis na tej wersji
// w mapach `plans` (projekt, kalibracja, encje) i `studySiteItems` (pozycje list karty budowy).

const H = (c: string) => c.repeat(64);
const project = (over: Partial<AnalysisProject> = {}): AnalysisProject => ({
  id: "p1", name: "Plan", image: { ref: H("a"), type: "image/png", size: 1000, w: 2000, h: 1000 }, status: "draft", createdAt: 1, updatedAt: 1, ...over,
});
const route = (over: Partial<PipeRoute> = {}): PipeRoute => ({ id: "r1", system: "cold", pts: [0, 0, 100, 0], source: "manual", verified: true, at: 1, ...over });

/** Dopisuje pole nowszej wersji do surowego wpisu mapy. */
function addFuture(map: Y.Map<unknown>, key: string) {
  map.set(key, { ...(map.get(key) as object), xFuture: "z" });
}

describe("D1.1 plans", () => {
  it("projekt, kalibracja i trasa: zmiana zostawia nieznane pole, usunięte znane pole nie wraca", () => {
    const doc = new Y.Doc();
    const y = createYPlans(doc);
    const map = doc.getMap<unknown>("plans");
    expect(y.createProject(project({ siteId: "s1" }))).toBe(true);
    const pKey = [...map.keys()].find((k) => (map.get(k) as { id?: string })?.id === "p1")!;
    addFuture(map, pKey);
    y.updateProject("p1", { name: "Nowa nazwa", siteId: undefined }, 5);
    expect(map.get(pKey)).toMatchObject({ name: "Nowa nazwa", xFuture: "z" });
    expect(map.get(pKey)).not.toHaveProperty("siteId");

    y.setCalibration("p1", { a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, meters: 2, at: 1 });
    const cKey = [...map.keys()].find((k) => (map.get(k) as { meters?: number })?.meters === 2)!;
    addFuture(map, cKey);
    y.setCalibration("p1", { a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, meters: 3, at: 2 });
    expect(map.get(cKey)).toMatchObject({ meters: 3, xFuture: "z" });

    y.save("r", "p1", route({ label: "pion" }));
    const rKey = [...map.keys()].find((k) => (map.get(k) as { id?: string; pts?: unknown })?.id === "r1" && (map.get(k) as { pts?: unknown }).pts)!;
    addFuture(map, rKey);
    y.save("r", "p1", route({ verified: false }));
    expect(map.get(rKey)).toMatchObject({ verified: false, xFuture: "z" });
    expect(map.get(rKey)).not.toHaveProperty("label");
  });
});

describe("D1.1 studySiteItems", () => {
  it("etap i brak: zmiana pozycji zostawia nieznane pole", () => {
    const doc = new Y.Doc();
    const s = createYStudy(doc);
    const items = doc.getMap<unknown>("studySiteItems");
    s.saveSite({ id: "k1", name: "Lipowa 5", address: "", investor: "", created: 1 });
    const stages = [{ id: "woda", name: "Rozprowadzenie wody" }];
    s.setSiteList("k1", "stage", stages, []);
    const sKey = [...items.keys()].find((k) => (items.get(k) as { name?: string })?.name === "Rozprowadzenie wody")!;
    addFuture(items, sKey);
    const base = s.get().sites.k1.stages!;
    s.setSiteList("k1", "stage", base.map((x) => ({ ...x, done: 500 })), base);
    expect(items.get(sKey)).toMatchObject({ done: 500, xFuture: "z" });
  });
});
