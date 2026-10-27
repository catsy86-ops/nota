import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ReminderChip } from "./ReminderChip";
import { isOverdueOccurrence } from "@/lib/dueTerms";
import type { Occurrence } from "@/lib/reminderOccurrences";

const occ = (at: number, extra: Partial<Occurrence> = {}): Occurrence =>
  ({ noteId: "n", at, allDay: false, isSeries: false, isNext: true, repeat: { kind: "none" }, ...extra } as unknown as Occurrence);

const HOUR = 60 * 60_000;

// K1.1: zaległy termin nie wygląda jak zwykły ani załatwiony.
describe("chip terminu — zaległe (K1.1)", () => {
  it("minął: czerwony ton i słowo „zaległe” w opisie", () => {
    const { container } = render(<ReminderChip occurrence={occ(Date.now() - 2 * HOUR)} title="Dentysta" />);
    const chip = container.firstElementChild as HTMLElement;
    expect(chip.className).toContain("text-destructive-ink");
    expect(chip.className).toContain("border-l-destructive");
    expect(chip.getAttribute("title")).toContain("zaległe");
  });

  it("przed czasem: zwykły ton, bez słowa „zaległe”", () => {
    const { container } = render(<ReminderChip occurrence={occ(Date.now() + 2 * HOUR)} title="Dentysta" />);
    const chip = container.firstElementChild as HTMLElement;
    expect(chip.className).not.toContain("text-destructive-ink");
    expect(chip.getAttribute("title")).not.toContain("zaległe");
  });

  it("termin „cały dzień” z dzisiaj nie jest zaległy w ciągu dnia (jak termStatus)", () => {
    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    expect(isOverdueOccurrence({ at: startToday.getTime(), allDay: true })).toBe(false);
    expect(isOverdueOccurrence({ at: startToday.getTime(), allDay: false })).toBe(true);
  });
});
