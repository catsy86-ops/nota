import { describe, expect, it } from "vitest";
import { parsePastedChecklist } from "./checklistPaste";

describe("parsePastedChecklist", () => {
  it("zwraca null dla jednej linii", () => {
    expect(parsePastedChecklist("mleko")).toBeNull();
    expect(parsePastedChecklist("  mleko \n\n")).toBeNull();
  });

  it("dzieli linie i pomija puste", () => {
    expect(parsePastedChecklist("mleko\r\n\nchleb\n  masło  ")).toEqual([
      { text: "mleko", checked: false },
      { text: "chleb", checked: false },
      { text: "masło", checked: false },
    ]);
  });

  it("zdejmuje punktory i numerację", () => {
    expect(parsePastedChecklist("- a\n* b\n• c\n1. d\n2) e")!.map((i) => i.text)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("rozpoznaje zadania Markdown", () => {
    expect(parsePastedChecklist("- [ ] a\n- [x] b\n[X] c")).toEqual([
      { text: "a", checked: false },
      { text: "b", checked: true },
      { text: "c", checked: true },
    ]);
  });

  it("nie rusza liczb, które nie są numeracją", () => {
    expect(parsePastedChecklist("2025 rok\n-5 stopni")!.map((i) => i.text)).toEqual(["2025 rok", "-5 stopni"]);
  });
});
