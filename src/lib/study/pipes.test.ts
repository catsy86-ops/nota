import { describe, it, expect } from "vitest";
import { cleanPipes, metersLabel, parseMeters, pipesLine, PIPES_MAX, PIPE_CM_MAX, sumPipes, suggestPipeNames } from "./pipes";
import { cleanEntry } from "./journalEntry";

describe("rury w metrach (H1.1)", () => {
  it("cleanPipes: zaokrągla do centymetra, odrzuca zera i śmieci, sumuje tę samą nazwę", () => {
    expect(cleanPipes([
      { name: "  Rura PEX 16×2 ", cm: 2450.4 },
      { name: "rura pex 16×2", cm: 50 },
      { name: "", cm: 100 },
      { name: "Rura PVC 110", cm: 0 },
      { name: "Rura PVC 50", cm: Number.NaN },
      "x",
    ])).toEqual([{ name: "Rura PEX 16×2", cm: 2500 }]);
    expect(cleanPipes("x")).toEqual([]);
  });

  it("cleanPipes: limit pozycji i długości", () => {
    const many = Array.from({ length: PIPES_MAX + 3 }, (_, i) => ({ name: `Rura ${i}`, cm: 100 }));
    expect(cleanPipes(many)).toHaveLength(PIPES_MAX);
    expect(cleanPipes([{ name: "Rura", cm: PIPE_CM_MAX * 3 }])[0].cm).toBe(PIPE_CM_MAX);
  });

  it("parseMeters: przecinek, kropka, jednostka; zero i tekst → null", () => {
    expect(parseMeters("24,5")).toBe(2450);
    expect(parseMeters("24.5 m")).toBe(2450);
    expect(parseMeters("3m")).toBe(300);
    expect(parseMeters("24,")).toBe(2400);
    expect(parseMeters("0,004")).toBeNull();
    expect(parseMeters("0")).toBeNull();
    expect(parseMeters("dużo")).toBeNull();
    expect(parseMeters("2000")).toBeNull();
  });

  it("metersLabel i pipesLine: przecinek dziesiętny, bez zbędnych zer", () => {
    expect(metersLabel(2450)).toBe("24,5 m");
    expect(metersLabel(300)).toBe("3 m");
    expect(metersLabel(1234567)).toBe("12345,67 m");
    expect(pipesLine([{ name: "Rura PEX 16×2", cm: 2450 }, { name: "Rura PVC 110", cm: 300 }])).toBe("Rura PEX 16×2: 24,5 m, Rura PVC 110: 3 m");
  });

  it("sumPipes i podpowiedzi: suma z wpisów, od najdłuższej; bez już wpisanych", () => {
    const history = [[{ name: "Rura PVC 110", cm: 300 }], [{ name: "Rura PEX 16×2", cm: 2000 }, { name: "rura pvc 110", cm: 200 }]];
    expect(sumPipes(history)).toEqual([{ name: "Rura PEX 16×2", cm: 2000 }, { name: "Rura PVC 110", cm: 500 }]);
    const names = suggestPipeNames(history, ["Rura PEX 16×2"]);
    expect(names[0]).toBe("Rura PVC 110");
    expect(names).not.toContain("Rura PEX 16×2");
  });

  it("wpis z samymi rurami nie jest pusty; rury zostają w czystym wpisie", () => {
    const e = cleanEntry({ id: "e1", at: 1, kind: "ok", text: "", images: [], checked: [], pipes: [{ name: "Rura PEX 16×2", cm: 2450 }] });
    expect(e?.pipes).toEqual([{ name: "Rura PEX 16×2", cm: 2450 }]);
    expect(cleanEntry({ id: "e2", at: 1, kind: "ok", text: "", images: [], checked: [], pipes: [] })).toBeNull();
  });
});
