import { describe, expect, it } from "vitest";
import { convertPressure, EXPANSION, PIPE_THREADS, thermalExpansionMm } from "./cheats";

describe("ściągi", () => {
  it("ciśnienie: 1 bar = 0,1 MPa = 100 kPa; 10 m H₂O ≈ 0,98 bar; w obie strony to samo", () => {
    expect(convertPressure(1, "bar", "MPa")).toBeCloseTo(0.1, 10);
    expect(convertPressure(1, "bar", "kPa")).toBe(100);
    expect(convertPressure(10, "mH2O", "bar")).toBeCloseTo(0.980665, 6);
    expect(convertPressure(1, "bar", "psi")).toBeCloseTo(14.5038, 3);
    expect(convertPressure(convertPressure(6, "bar", "psi"), "psi", "bar")).toBeCloseTo(6, 10);
  });

  it("gwinty: rosnąco, 1/2″ to DN15 i 20,955 mm", () => {
    const half = PIPE_THREADS.find((t) => t.inch === "1/2")!;
    expect(half).toMatchObject({ dn: 15, majorMm: 20.955, tpi: 14 });
    for (let i = 1; i < PIPE_THREADS.length; i++) expect(PIPE_THREADS[i].majorMm).toBeGreaterThan(PIPE_THREADS[i - 1].majorMm);
  });

  it("wydłużenie: 10 m PEX przy 50 K to 75 mm; stabilizowana PP kilka razy mniej", () => {
    const pex = EXPANSION.find((m) => m.id === "pex")!;
    const stabi = EXPANSION.find((m) => m.id === "pp-stabi")!;
    expect(thermalExpansionMm(pex.mmPerMK, 10, 50)).toBeCloseTo(75, 10);
    expect(thermalExpansionMm(stabi.mmPerMK, 10, 50)).toBeCloseTo(15, 10);
    for (const m of EXPANSION) expect(m.source).toBeTruthy();
  });
});
