import { describe, expect, it } from "vitest";
import { brainPlan } from "./brainTraining";
import { type ShiftData } from "@/lib/shifts/model";
import { TEST_SHIFT_TYPES, TEST_EMPTY_SHIFT_DATA } from "@/lib/shifts/testShiftTypes";

const day = TEST_SHIFT_TYPES.find((t) => t.kind !== "absence")!; // 06:00–14:00 wg domyślnych rodzajów
const at = (h: number, m = 0) => new Date(2026, 9, 22, h, m);
const data = (over: Partial<ShiftData>): ShiftData => ({ ...TEST_EMPTY_SHIFT_DATA, types: [day], days: { "2026-10-22": { type: day.id } }, ...over });

describe("brainPlan — trening mózgu względem zmiany", () => {
  it("godzinę przed zmianą: rozgrzewka z przypomnieniem 30 min przed startem", () => {
    const p = brainPlan(data({}), at(5, 0));
    expect(p.mode).toBe("before");
    expect(p.remindAt).toBe(at(5, 30).getTime());
  });

  it("w trakcie zmiany: przypomnienie 10 min po końcu", () => {
    const p = brainPlan(data({}), at(10, 0));
    expect(p.mode).toBe("working");
    expect(p.remindAt).toBe(at(14, 10).getTime());
  });

  it("godzinę po zmianie: wyciszenie bez przypomnienia", () => {
    const p = brainPlan(data({}), at(15, 0));
    expect(p.mode).toBe("after");
    expect(p.remindAt).toBeNull();
  });

  it("dzień bez zmiany: codzienny trening", () => {
    const p = brainPlan(data({ days: {} }), at(9, 0));
    expect(p.mode).toBe("free");
  });
});
