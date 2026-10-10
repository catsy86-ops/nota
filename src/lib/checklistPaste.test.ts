import { describe, expect, it } from "vitest";
import { checklistToContent, contentToChecklist, parsePastedChecklist } from "./checklistPaste";

describe("parsePastedChecklist", () => {
  it("zwraca null dla jednej linii", () => {
    expect(parsePastedChecklist("mleko")).toBeNull();
    expect(parsePastedChecklist("  mleko \n\n")).toBeNull();
  });

  it("dzieli linie i pomija puste", () => {
    expect(parsePastedChecklist("mleko\r\n\nchleb\nmasło  ")).toEqual([
      { text: "mleko", checked: false },
      { text: "chleb", checked: false },
      { text: "masło", checked: false },
    ]);
  });

  it("wcięta linia to podzadanie, ale nie pierwsza pozycja", () => {
    expect(parsePastedChecklist("  zakupy\n  - [x] mleko\n\tchleb\nsprzątanie")).toEqual([
      { text: "zakupy", checked: false },
      { text: "mleko", checked: true, indent: 1 },
      { text: "chleb", checked: false, indent: 1 },
      { text: "sprzątanie", checked: false },
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

describe("konwersja tekst ↔ lista", () => {
  let n = 0;
  const makeId = () => `id${++n}`;

  it("Zamień na listę dopisuje linie za istniejącymi pozycjami", () => {
    const r = contentToChecklist("- jabłka\n\n- [x] gruszki", [{ id: "a", text: "mleko", checked: false }], makeId);
    expect(r.content).toBe("");
    expect(r.checklist.map(({ text, checked }) => ({ text, checked }))).toEqual([
      { text: "mleko", checked: false },
      { text: "jabłka", checked: false },
      { text: "gruszki", checked: true },
    ]);
  });

  it("Zamień na listę działa też dla jednej linii", () => {
    expect(contentToChecklist("mleko", [], makeId).checklist).toHaveLength(1);
  });

  it("Zamień na tekst dopisuje zadania Markdown pod treścią", () => {
    const items = [{ id: "a", text: "a", checked: false }, { id: "b", text: "b", checked: true }];
    expect(checklistToContent("Zakupy\n", items)).toEqual({ content: "Zakupy\n- [ ] a\n- [x] b", checklist: [] });
    expect(checklistToContent("", items).content).toBe("- [ ] a\n- [x] b");
  });

  it("tam i z powrotem zachowuje odhaczenie", () => {
    const items = [{ id: "a", text: "a", checked: true }];
    const back = contentToChecklist(checklistToContent("", items).content, [], makeId).checklist;
    expect(back.map((i) => i.checked)).toEqual([true]);
  });
});
