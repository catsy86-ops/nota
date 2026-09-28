import { describe, it, expect } from "vitest";
import { linesToChecklistItems, checklistItemsToText, contentToChecklist, checklistToContent } from "./checklistText";

let n = 0;
const id = () => `id${++n}`;

describe("linesToChecklistItems", () => {
  it("pomija puste linie i zdejmuje znaczniki", () => {
    const items = linesToChecklistItems("- mleko\n\n* chleb\r\n  jajka  \n1. masło", id);
    expect(items.map((i) => i.text)).toEqual(["mleko", "chleb", "jajka", "masło"]);
    expect(items.every((i) => !i.checked)).toBe(true);
  });
  it("[x] odhacza, [ ] nie", () => {
    const items = linesToChecklistItems("- [ ] a\n- [x] b\n[X] c", id);
    expect(items.map((i) => [i.text, i.checked])).toEqual([["a", false], ["b", true], ["c", true]]);
  });
  it("zostawia myślnik w środku tekstu i liczbę bez kropki", () => {
    expect(linesToChecklistItems("ala - kot\n-5 stopni", id).map((i) => i.text)).toEqual(["ala - kot", "-5 stopni"]);
  });
});

describe("konwersja tekst ↔ lista", () => {
  it("checklistItemsToText", () => {
    expect(checklistItemsToText([{ id: "1", text: "a", checked: false }, { id: "2", text: "b", checked: true }])).toBe("- [ ] a\n- [x] b");
  });
  it("contentToChecklist dopisuje za istniejącymi i czyści treść", () => {
    const r = contentToChecklist("x\ny", [{ id: "0", text: "stara", checked: true }], id);
    expect(r.content).toBe("");
    expect(r.checklist.map((i) => i.text)).toEqual(["stara", "x", "y"]);
  });
  it("checklistToContent dopisuje pod treścią i czyści listę", () => {
    const r = checklistToContent("Nagłówek\n", [{ id: "1", text: "a", checked: true }]);
    expect(r).toEqual({ content: "Nagłówek\n- [x] a", checklist: [] });
    expect(checklistToContent("", [{ id: "1", text: "a", checked: false }]).content).toBe("- [ ] a");
  });
  it("tam i z powrotem zachowuje tekst i stan", () => {
    const items = [{ id: "1", text: "a", checked: false }, { id: "2", text: "b", checked: true }];
    const back = linesToChecklistItems(checklistItemsToText(items), id);
    expect(back.map(({ text, checked }) => ({ text, checked }))).toEqual(items.map(({ text, checked }) => ({ text, checked })));
  });
});
