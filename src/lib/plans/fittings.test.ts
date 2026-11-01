import { describe, expect, it } from "vitest";
import { pickSymbol, proposeFittings, turnAngle } from "./fittings";
import type { DetectedSymbol, PipeRoute } from "./model";

const route = (id: string, pts: number[], system: PipeRoute["system"] = "cold"): PipeRoute => ({ id, system, pts, source: "manual", verified: true, at: 1 });
const sym = (id: string, x: number, y: number): DetectedSymbol => ({ id, type: "elbow", x, y, manual: true, verified: true, at: 1 });

describe("kształtki z geometrii tras (faza 6)", () => {
  it("kąt zmiany kierunku", () => {
    expect(turnAngle({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 })).toBeCloseTo(0);
    expect(turnAngle({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 })).toBeCloseTo(90);
  });

  it("kolano w załamaniu 90°, nie na prostej i nie w łagodnym łuku", () => {
    const p = proposeFittings([route("a", [0, 0, 100, 0, 100, 100, 110, 200])], [], 8);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ type: "elbow", x: 100, y: 0, system: "cold", routeIds: ["a"] });
    expect(p[0].confidence).toBeGreaterThan(0.9);
  });

  it("trójnik tylko, gdy koniec trasy leży na innej trasie tej samej instalacji", () => {
    const main = route("main", [0, 0, 200, 0]);
    const branch = route("branch", [100, 0, 100, 80]);
    const hot = route("hot", [50, 0, 50, 60], "hot");
    const cross = route("cross", [150, -50, 150, 50]);
    const p = proposeFittings([main, branch, hot, cross], [], 6);
    const tees = p.filter((f) => f.type === "tee");
    // Odgałęzienie zimnej wody — tak; ciepła woda na zimnej i przecięcie przez środek — nie.
    expect(tees).toEqual([expect.objectContaining({ x: 100, y: 0, routeIds: ["branch", "main"] })]);
  });

  it("koniec przy końcu innej trasy to nie trójnik; symbol w pobliżu nie jest proponowany drugi raz", () => {
    expect(proposeFittings([route("a", [0, 0, 100, 0]), route("b", [100, 2, 100, 80])], [], 6).filter((f) => f.type === "tee")).toEqual([]);
    expect(proposeFittings([route("a", [0, 0, 100, 0, 100, 100])], [sym("s", 102, 3)], 8)).toEqual([]);
  });

  it("zaznaczanie symbolu stuknięciem", () => {
    expect(pickSymbol([sym("a", 10, 10), sym("b", 50, 50)], { x: 48, y: 53 }, 10)).toBe("b");
    expect(pickSymbol([sym("a", 10, 10)], { x: 80, y: 80 }, 10)).toBeNull();
  });
});
