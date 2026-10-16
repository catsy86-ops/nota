import { describe, it, expect } from "vitest";
import { addParked, parkedLabel, PARKED_LABEL_MAX, PARKED_MAX, removeParked } from "./parkedDrafts";

describe("parkedLabel", () => {
  it("tytuł ma pierwszeństwo, potem pierwsza linia treści, potem pozycja listy", () => {
    expect(parkedLabel({ title: "Plan", content: "treść", checklist: [] })).toBe("Plan");
    expect(parkedLabel({ title: " ", content: "\n  pierwsza\ndruga", checklist: [] })).toBe("pierwsza");
    expect(parkedLabel({ title: "", content: "", checklist: [{ text: "mleko" }] })).toBe("mleko");
  });

  it("pusty szkic dostaje „Bez tytułu”", () => {
    expect(parkedLabel({ title: "", content: "", checklist: [] })).toBe("Bez tytułu");
  });

  it("długa etykieta jest obcinana wielokropkiem", () => {
    const label = parkedLabel({ title: "x".repeat(200), content: "", checklist: [] });
    expect(label).toHaveLength(PARKED_LABEL_MAX);
    expect(label.endsWith("…")).toBe(true);
  });
});

describe("addParked / removeParked", () => {
  it("najnowszy szkic jest pierwszy", () => {
    let list = addParked([], "A", "1", 1);
    list = addParked(list, "B", "2", 2);
    expect(list.map((p) => p.id)).toEqual(["2", "1"]);
  });

  it("ponad limit odpada najstarszy", () => {
    let list: ReturnType<typeof addParked<string>> = [];
    for (let i = 0; i < PARKED_MAX + 3; i++) list = addParked(list, `d${i}`, `id${i}`, i);
    expect(list).toHaveLength(PARKED_MAX);
    expect(list[0].id).toBe(`id${PARKED_MAX + 2}`);
  });

  it("usunięcie zostawia resztę w kolejności", () => {
    let list = addParked([], "A", "1", 1);
    list = addParked(list, "B", "2", 2);
    list = addParked(list, "C", "3", 3);
    expect(removeParked(list, "2").map((p) => p.id)).toEqual(["3", "1"]);
  });
});
