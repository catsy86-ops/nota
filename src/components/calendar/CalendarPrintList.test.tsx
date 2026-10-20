import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CalendarPrintList } from "./CalendarPrintList";
import type { Occurrence } from "@/lib/reminderOccurrences";

const occ = (over: Partial<Occurrence>): Occurrence => ({
  noteId: "n1", at: new Date(2026, 9, 12, 9, 30).getTime(), isSeries: false, index: 0, isNext: true, repeat: "none", allDay: false, ...over,
});

describe("CalendarPrintList", () => {
  it("wypisuje terminy dzień po dniu, z godziną albo „cały dzień” i oznaczeniem prognozy", () => {
    const byDay = new Map<string, Occurrence[]>([
      ["2026-10-12", [occ({ at: new Date(2026, 9, 12, 9, 30).getTime() })]],
      ["2026-10-20", [occ({ noteId: "n2", allDay: true, at: new Date(2026, 9, 20, 9, 0).getTime() }), occ({ noteId: "n3", isSeries: true, isNext: false, repeat: "daily", at: new Date(2026, 9, 20, 18, 0).getTime() })]],
    ]);
    render(<CalendarPrintList month={new Date(2026, 9, 1)} byDay={byDay} titleOf={(id) => `Tytuł ${id}`} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Terminy: październik 2026");
    expect(screen.getByText(/09:30 — Tytuł n1/)).toBeInTheDocument();
    expect(screen.getByText(/cały dzień — Tytuł n2/)).toBeInTheDocument();
    expect(screen.getByText(/18:00 — Tytuł n3 \(prognoza serii\)/)).toBeInTheDocument();
  });

  it("pomija dni spoza miesiąca i pokazuje komunikat, gdy nic nie ma", () => {
    const byDay = new Map<string, Occurrence[]>([["2026-11-02", [occ({})]]]);
    render(<CalendarPrintList month={new Date(2026, 9, 1)} byDay={byDay} titleOf={() => "x"} />);
    expect(screen.getByText("Brak terminów w tym miesiącu.")).toBeInTheDocument();
  });
});
