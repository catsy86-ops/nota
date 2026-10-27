import { describe, expect, it } from "vitest";
import { snapDecision } from "./sheet-snap";

describe("snapDecision — punkty „pół” i „pełny”", () => {
  it("z „pół” przeciągnięcie w górę o 40 px+ otwiera „pełny”", () => {
    expect(snapDecision({ snap: "half", dy: -60, velocity: -0.2 })).toBe("full");
  });

  it("z „pół” krótki ruch w górę zostaje na „pół”", () => {
    expect(snapDecision({ snap: "half", dy: -20, velocity: -0.1 })).toBe("half");
  });

  it("z „pół” szybki ruch w górę otwiera „pełny” nawet przy małej odległości", () => {
    expect(snapDecision({ snap: "half", dy: -35, velocity: -0.9 })).toBe("full");
  });

  it("z „pół” przeciągnięcie w dół o 110 px+ zamyka arkusz", () => {
    expect(snapDecision({ snap: "half", dy: 120, velocity: 0.1 })).toBe("close");
  });

  it("z „pół” szybki ruch w dół zamyka arkusz", () => {
    expect(snapDecision({ snap: "half", dy: 40, velocity: 0.8 })).toBe("close");
  });

  it("z „pół” lekkie przeciągnięcie w dół wraca na „pół”", () => {
    expect(snapDecision({ snap: "half", dy: 50, velocity: 0.1 })).toBe("half");
  });

  it("z „pełny” przeciągnięcie w dół wraca na „pół”, nie zamyka", () => {
    expect(snapDecision({ snap: "full", dy: 150, velocity: 0.2 })).toBe("half");
  });

  it("z „pełny” ruch w górę zostaje na „pełny”", () => {
    expect(snapDecision({ snap: "full", dy: -200, velocity: -0.9 })).toBe("full");
  });

  it("z „pełny” lekki ruch w dół zostaje na „pełny”", () => {
    expect(snapDecision({ snap: "full", dy: 20, velocity: 0.1 })).toBe("full");
  });
});
