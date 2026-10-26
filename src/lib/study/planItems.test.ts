import { describe, expect, it } from "vitest";
import { activePlanItems, cleanPlanItems, PLAN_MAX } from "./planItems";

const at = (d: number, h = 9) => new Date(2026, 9, d, h).getTime();

describe("plan na dziś (P-5)", () => {
  it("czyści pozycje: przycina tekst, odrzuca puste i zdublowane, limit 5", () => {
    const raw = [
      { id: "a", text: "  Ułożyć   rury ", at: 1 },
      { id: "a", text: "duplikat", at: 2 },
      { id: "b", text: "   ", at: 3 },
      { id: "c", text: "x".repeat(200), at: 4 },
      ...Array.from({ length: 6 }, (_, i) => ({ id: `n${i}`, text: `zadanie ${i}`, at: 10 + i })),
    ];
    const out = cleanPlanItems(raw);
    expect(out[0]).toEqual({ id: "a", text: "Ułożyć rury", at: 1 });
    expect(out.length).toBe(PLAN_MAX);
    expect(out.find((i) => i.id === "c")?.text.length).toBe(80);
    expect(cleanPlanItems("nie-lista")).toEqual([]);
  });

  it("zrobione wczoraj znikają z widoku, niezrobione zostają na jutro", () => {
    const items = [
      { id: "wczoraj-zrobione", text: "A", at: at(19), doneAt: at(19, 15) },
      { id: "niezrobione", text: "B", at: at(19) },
      { id: "dzisiaj-zrobione", text: "C", at: at(20), doneAt: at(20, 10) },
    ];
    const today = activePlanItems(items, at(20, 12)).map((i) => i.id);
    expect(today).toEqual(["niezrobione", "dzisiaj-zrobione"]);
  });
});
