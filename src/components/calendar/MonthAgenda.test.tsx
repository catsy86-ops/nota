import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MonthAgenda } from "./MonthAgenda";
import type { Occurrence } from "@/lib/reminderOccurrences";

const occ = (noteId: string, day: number, h: number): Occurrence =>
  ({ noteId, at: new Date(2026, 9, day, h, 0).getTime(), allDay: false, isSeries: false, isNext: true } as unknown as Occurrence);

describe("agenda miesiąca (K-3)", () => {
  it("pokazuje tylko dni z terminem lub zmianą, w kolejności dat", () => {
    const byDay = new Map<string, Occurrence[]>([
      ["2026-10-20", [occ("b", 20, 15)]],
      ["2026-10-05", [occ("a", 5, 9)]],
    ]);
    const shiftOf = (k: string) => (k === "2026-10-12" ? "Ranna 6–14" : undefined);
    const { container } = render(<MonthAgenda month={new Date(2026, 9, 1)} byDay={byDay} titleOf={(id) => `Termin ${id}`} shiftOf={shiftOf} onSelectDay={() => {}} />);
    const sections = Array.from(container.querySelectorAll<HTMLElement>("section[role=listitem]"));
    expect(sections).toHaveLength(3);
    expect(sections[0].getAttribute("aria-label")).toMatch(/5 październik/);
    expect(sections[1].textContent).toContain("Ranna 6–14");
  });

  it("pusty miesiąc mówi to wprost", () => {
    render(<MonthAgenda month={new Date(2026, 9, 1)} byDay={new Map()} titleOf={() => ""} onSelectDay={() => {}} />);
    expect(screen.getByText("Brak terminów i zmian w tym miesiącu.")).toBeTruthy();
  });
});
