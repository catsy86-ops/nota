import { describe, expect, it } from "vitest";
import { dayDots } from "./dayDots";
import type { Occurrence } from "@/lib/reminderOccurrences";

const NOW = new Date(2026, 10, 5, 12, 0).getTime();
const H = 3600_000;
const occ = (noteId: string, at: number, extra: Partial<Occurrence> = {}): Occurrence =>
  ({ noteId, at, isSeries: false, index: 0, isNext: true, repeat: "none", ...extra }) as Occurrence;

describe("kropki wąskiej komórki dnia", () => {
  it("seria kilka razy dziennie to jedna kropka, a nie rząd kręgów („0000 +3”)", () => {
    const series = Array.from({ length: 7 }, (_, i) => occ("s", NOW + (i + 1) * H, { isSeries: true, index: i + 1, isNext: i === 0 }));
    const { dots, hidden } = dayDots(series, 4, NOW);
    expect(dots).toEqual([{ noteId: "s", kind: "saved", count: 7 }]);
    expect(hidden).toBe(0);
  });

  it("sama prognoza serii zostaje pustym kręgiem, zaległy ma pierwszeństwo przed zapisanym", () => {
    const { dots } = dayDots([
      occ("f", NOW + H, { isSeries: true, index: 3, isNext: false }),
      occ("o", NOW + 2 * H),
      occ("o", NOW - H),
    ], 4, NOW);
    expect(dots.map((d) => [d.noteId, d.kind])).toEqual([["f", "forecast"], ["o", "overdue"]]);
  });

  it("„+N” liczy kolejne notatki, nie wystąpienia", () => {
    const many = ["a", "b", "c", "d", "e", "f"].flatMap((id) => [occ(id, NOW + H), occ(id, NOW + 2 * H)]);
    expect(dayDots(many, 4, NOW).hidden).toBe(2);
  });
});
