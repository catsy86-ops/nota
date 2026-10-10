import { describe, it, expect } from "vitest";
import type { Note } from "@/hooks/useNotes";
import { groupNotes, dateBucket, startOfWeek } from "@/lib/groupNotes";

function note(id: string, over: Partial<Note> = {}): Note {
  return { id, title: id, content: "", color: "default", pinned: false, archived: false, trashed: false, trashedAt: null, labels: [], reminder: null, createdAt: 0, updatedAt: 0, ...over } as Note;
}
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();
// Czwartek 15 października 2026, 14:00 (lokalnie).
const NOW = at(2026, 10, 15, 14);

describe("dateBucket", () => {
  it("granica dnia jest o północy lokalnej", () => {
    expect(dateBucket(at(2026, 10, 15, 0, 0), NOW)).toBe("today");
    expect(dateBucket(at(2026, 10, 14, 23, 59), NOW)).toBe("yesterday");
    expect(dateBucket(at(2026, 10, 14, 0, 0), NOW)).toBe("yesterday");
    expect(dateBucket(at(2026, 10, 13, 23, 59), NOW)).toBe("week");
  });
  it("tydzień zaczyna się w poniedziałek", () => {
    expect(startOfWeek(NOW)).toBe(at(2026, 10, 12, 0, 0));
    expect(dateBucket(at(2026, 10, 12, 0, 0), NOW)).toBe("week");
    expect(dateBucket(at(2026, 10, 11, 23, 59), NOW)).toBe("month"); // niedziela poprzedniego tygodnia
  });
  it("niedziela należy do kończącego się tygodnia", () => {
    const sunday = at(2026, 10, 18, 10);
    expect(startOfWeek(sunday)).toBe(at(2026, 10, 12, 0, 0));
    expect(dateBucket(at(2026, 10, 12, 8), sunday)).toBe("week");
  });
  it("początek miesiąca i starsze", () => {
    expect(dateBucket(at(2026, 10, 1, 0, 0), NOW)).toBe("month");
    expect(dateBucket(at(2026, 9, 30, 23, 59), NOW)).toBe("older");
  });
  it("w poniedziałek „ten tydzień” jest puste (wczoraj to niedziela)", () => {
    const monday = at(2026, 10, 12, 9);
    expect(dateBucket(at(2026, 10, 11, 20), monday)).toBe("yesterday");
    expect(dateBucket(at(2026, 10, 10, 20), monday)).toBe("month");
  });
  it("data z przyszłości trafia do „dzisiaj”", () => {
    expect(dateBucket(NOW + 3 * 86400000, NOW)).toBe("today");
  });
  it("przełom miesiąca: wczoraj to ostatni dzień poprzedniego", () => {
    const first = at(2026, 11, 1, 10);
    expect(dateBucket(at(2026, 10, 31, 22), first)).toBe("yesterday");
  });
});

describe("groupNotes", () => {
  it("none: jedna grupa z zachowaną kolejnością", () => {
    const g = groupNotes([note("a"), note("b")], "none", { now: NOW });
    expect(g).toHaveLength(1);
    expect(g[0].notes.map((n) => n.id)).toEqual(["a", "b"]);
    expect(groupNotes([], "none", { now: NOW })).toEqual([]);
  });
  it("date: porządek przedziałów, puste pomijane, kolejność wewnątrz zachowana", () => {
    const notes = [
      note("old", { updatedAt: at(2026, 8, 1) }),
      note("t2", { updatedAt: at(2026, 10, 15, 13) }),
      note("y", { updatedAt: at(2026, 10, 14, 9) }),
      note("t1", { updatedAt: at(2026, 10, 15, 8) }),
    ];
    const g = groupNotes(notes, "date", { now: NOW });
    expect(g.map((x) => x.label)).toEqual(["Dzisiaj", "Wczoraj", "Starsze"]);
    expect(g[0].notes.map((n) => n.id)).toEqual(["t2", "t1"]);
  });
  it("date: pole createdAt", () => {
    const n = note("a", { createdAt: at(2026, 8, 1), updatedAt: NOW });
    expect(groupNotes([n], "date", { now: NOW, dateField: "createdAt" })[0].key).toBe("older");
  });
  it("label: pierwsza etykieta, alfabetycznie, bez etykiety na końcu", () => {
    const notes = [note("1", { labels: ["żaba"] }), note("2"), note("3", { labels: ["ala", "żaba"] })];
    const g = groupNotes(notes, "label", { now: NOW });
    expect(g.map((x) => x.label)).toEqual(["#ala", "#żaba", "Bez etykiety"]);
    expect(g.flatMap((x) => x.notes).length).toBe(3);
  });
  it("folder: nazwy folderów, nieznany i brak do „Bez folderu”", () => {
    const folders = [{ id: "f1", name: "Praca" }, { id: "f2", name: "Dom" }];
    const notes = [note("1", { folderId: "f1" }), note("2", { folderId: "zgubiony" }), note("3", { folderId: "f2" }), note("4")];
    const g = groupNotes(notes, "folder", { now: NOW, folders });
    expect(g.map((x) => x.label)).toEqual(["Dom", "Praca", "Bez folderu"]);
    expect(g[2].notes.map((n) => n.id)).toEqual(["2", "4"]);
  });
});
