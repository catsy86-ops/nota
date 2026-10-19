import { describe, expect, it } from "vitest";
import { studyDayMarks } from "./calendarMarks";

const card = (extra: Record<string, unknown>) => ({ archived: undefined, service: [], shortages: [], ...extra }) as Parameters<typeof studyDayMarks>[0][string];

describe("znaczniki Pracy w kalendarzu (K2)", () => {
  it("liczy otwarte wizyty serwisowe i zamówione dostawy po dniu", () => {
    const marks = studyDayMarks({
      k1: card({
        service: [
          { id: "a", text: "Przeciek", at: 1, due: "2026-10-20" },
          { id: "b", text: "Syfon", at: 1, due: "2026-10-20" },
          { id: "c", text: "Zamknięte", at: 1, due: "2026-10-20", done: 2 },
          { id: "d", text: "Bez terminu", at: 1 },
        ],
        shortages: [
          { id: "e", text: "Rura", qty: "", status: "ordered", at: 1, due: new Date(2026, 9, 21, 12).getTime() },
          { id: "f", text: "Klej", qty: "", status: "delivered", at: 1, due: new Date(2026, 9, 21, 12).getTime() },
          { id: "g", text: "Kolano", qty: "", status: "ordered", at: 1 },
        ],
      }),
    });
    expect(marks.get("2026-10-20")).toEqual({ service: 2, delivery: 0 });
    expect(marks.get("2026-10-21")).toEqual({ service: 0, delivery: 1 });
    expect(marks.size).toBe(2);
  });

  it("budowy w archiwum nie dają znaczników", () => {
    const marks = studyDayMarks({
      k1: card({ archived: 1, service: [{ id: "a", text: "x", at: 1, due: "2026-10-20" }] }),
    });
    expect(marks.size).toBe(0);
  });
});
