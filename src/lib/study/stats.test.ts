import { describe, expect, it } from "vitest";
import type { ReviewCard } from "./srs";
import type { JournalEntry } from "./yStudy";
import { accuracyByTopic, daysInLast, entriesByMonth, entriesBySite, hardestQuestions, overallAccuracy, studyDaysGrid } from "./stats";

const card = (seen: number, right: number, lapses = seen - right): ReviewCard =>
  ({ reps: 1, interval: 1, ease: 2.5, due: "2026-10-16", last: "2026-10-15", lapses, seen, right });

const review = { q1: card(4, 3), q2: card(2, 0), q3: card(5, 5) };
const questions = [{ id: "q1", topic: "a" }, { id: "q2", topic: "a" }, { id: "q3", topic: "b" }, { id: "q4", topic: "c" }];

const entry = (id: string, at: number, site: string, over: Partial<JournalEntry> = {}): JournalEntry =>
  ({ id, at, kind: "note", topic: null, text: id, site, checked: [], images: [], ...over });

describe("statystyki działu Praca", () => {
  it("trafność ogółem i per temat — od najsłabszego, bez odpowiedzi na końcu", () => {
    expect(overallAccuracy(review)).toEqual({ seen: 11, right: 8, percent: 73 });
    expect(overallAccuracy({}).percent).toBeNull();
    expect(accuracyByTopic(review, questions, ["c", "b", "a"])).toEqual([
      { topic: "a", seen: 6, right: 3, percent: 50 },
      { topic: "b", seen: 5, right: 5, percent: 100 },
      { topic: "c", seen: 0, right: 0, percent: null },
    ]);
  });

  it("najtrudniejsze pytania: najwięcej pomyłek, tylko z pomyłką", () => {
    expect(hardestQuestions(review)).toEqual([{ id: "q2", lapses: 2, seen: 2 }, { id: "q1", lapses: 1, seen: 4 }]);
  });

  it("siatka dni: tygodnie od poniedziałku, dziś w ostatniej kolumnie, przyszłość oznaczona", () => {
    // 2026-10-15 to czwartek.
    const grid = studyDaysGrid(["2026-10-12", "2026-10-15", "2026-01-01"], "2026-10-15", 2);
    expect(grid).toHaveLength(2);
    expect(grid[0][0].key).toBe("2026-10-05");
    expect(grid[1][0]).toMatchObject({ key: "2026-10-12", studied: true });
    expect(grid[1][3]).toMatchObject({ key: "2026-10-15", studied: true, future: false });
    expect(grid[1][4]).toMatchObject({ key: "2026-10-16", future: true });
    expect(daysInLast(["2026-10-15", "2026-09-16", "2026-09-15", "2026-10-20"], "2026-10-15", 30)).toBe(2);
  });

  it("wpisy per miesiąc z pustymi miesiącami i per budowa z „Pozostałe”", () => {
    const now = new Date(2026, 9, 15).getTime();
    const months = entriesByMonth([entry("a", new Date(2026, 9, 1).getTime(), "X"), entry("b", new Date(2026, 7, 3).getTime(), "X"), entry("c", new Date(2025, 0, 1).getTime(), "X")], now, 3);
    expect(months).toEqual([
      { month: "2026-08", label: "sie", count: 1 },
      { month: "2026-09", label: "wrz", count: 0 },
      { month: "2026-10", label: "paź", count: 1 },
    ]);
    const j = [
      entry("1", 1, "Lipowa"), entry("2", 2, "Lipowa", { kind: "problem" }), entry("3", 3, "Polna"),
      entry("4", 4, "Akacjowa"), entry("5", 5, ""), entry("6", 6, "Wiśniowa"),
    ];
    expect(entriesBySite(j, 3)).toEqual([
      { site: "Lipowa", count: 2, open: 1 },
      { site: "Akacjowa", count: 1, open: 0 },
      { site: "Pozostałe", count: 3, open: 0 },
    ]);
  });
});
