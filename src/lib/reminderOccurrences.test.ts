import { describe, it, expect } from "vitest";
import { expandOccurrences, groupByDay, dayKey } from "./reminderOccurrences";
import type { Note } from "@/hooks/useNotes";

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "1",
    title: "",
    content: "",
    color: "default",
    pinned: false,
    archived: false,
    trashed: false,
    trashedAt: null,
    labels: [],
    reminder: null,
    priority: "none",
    images: [],
    checklist: [],
    folderId: null,
    order: 0,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

const at = (y: number, m: number, d: number, h = 9, min = 0) => new Date(y, m - 1, d, h, min, 0, 0).getTime();
const MARCH = { start: at(2026, 3, 1, 0, 0), end: at(2026, 3, 31, 23, 59) };

describe("expandOccurrences", () => {
  it("jednorazowe przypomnienie w zakresie daje dokładnie jedno wystąpienie", () => {
    const notes = [makeNote({ reminder: at(2026, 3, 14, 15, 30) })];
    const occ = expandOccurrences(notes, MARCH.start, MARCH.end);
    expect(occ).toHaveLength(1);
    expect(occ[0]).toMatchObject({ noteId: "1", isSeries: false, index: 0, isNext: true, repeat: "none" });
  });

  it("jednorazowe przypomnienie poza zakresem nie daje nic", () => {
    const notes = [makeNote({ reminder: at(2026, 4, 2) })];
    expect(expandOccurrences(notes, MARCH.start, MARCH.end)).toEqual([]);
  });

  it("notatka bez przypomnienia jest pomijana", () => {
    expect(expandOccurrences([makeNote({ reminder: null })], MARCH.start, MARCH.end)).toEqual([]);
  });

  it("kosz jest pomijany, archiwum nie", () => {
    const notes = [
      makeNote({ id: "kosz", reminder: at(2026, 3, 10), trashed: true }),
      makeNote({ id: "archiwum", reminder: at(2026, 3, 10), archived: true }),
    ];
    const occ = expandOccurrences(notes, MARCH.start, MARCH.end);
    expect(occ.map((o) => o.noteId)).toEqual(["archiwum"]);
  });

  it("seria codzienna wypełnia cały zakres", () => {
    const notes = [makeNote({ reminder: at(2026, 3, 1, 8), reminderRepeat: "daily" })];
    const occ = expandOccurrences(notes, MARCH.start, MARCH.end);
    expect(occ).toHaveLength(31);
    expect(occ.every((o) => new Date(o.at).getHours() === 8)).toBe(true);
  });

  it("seria tygodniowa daje wystąpienia co 7 dni", () => {
    const notes = [makeNote({ reminder: at(2026, 3, 2), reminderRepeat: "weekly" })];
    const occ = expandOccurrences(notes, MARCH.start, MARCH.end);
    expect(occ.map((o) => new Date(o.at).getDate())).toEqual([2, 9, 16, 23, 30]);
  });

  it("tylko pierwsze wystąpienie serii jest tym realnie zapisanym", () => {
    const notes = [makeNote({ reminder: at(2026, 3, 2), reminderRepeat: "weekly" })];
    const occ = expandOccurrences(notes, MARCH.start, MARCH.end);
    expect(occ[0]).toMatchObject({ index: 0, isNext: true, isSeries: true });
    expect(occ.slice(1).every((o) => o.isNext === false)).toBe(true);
    expect(occ.map((o) => o.index)).toEqual([0, 1, 2, 3, 4]);
  });

  it("nie generuje wystąpień sprzed zapisanego terminu — model nie zna historii serii", () => {
    // Seria zaczyna się w marcu; luty musi zostać pusty, choć „co tydzień”
    // sugeruje, że coś tam było.
    const notes = [makeNote({ reminder: at(2026, 3, 10), reminderRepeat: "weekly" })];
    const february = expandOccurrences(notes, at(2026, 2, 1, 0, 0), at(2026, 2, 28, 23, 59));
    expect(february).toEqual([]);
  });

  it("seria zaczęta przed zakresem jest widoczna w zakresie, z zachowanym numerem wystąpienia", () => {
    const notes = [makeNote({ reminder: at(2026, 1, 5, 7, 45), reminderRepeat: "weekly" })];
    const occ = expandOccurrences(notes, MARCH.start, MARCH.end);
    expect(occ.length).toBeGreaterThan(0);
    expect(occ[0].index).toBeGreaterThan(0);
    expect(occ[0].isNext).toBe(false);
    expect(new Date(occ[0].at).getHours()).toBe(7);
  });

  it("seria miesięczna od 31.: w krótszym miesiącu ostatni dzień, potem wraca na 31.", () => {
    // Dawniej `setMonth` przepełniał datę: 31 stycznia → 3 marca → 3 kwietnia.
    const notes = [makeNote({ reminder: at(2026, 1, 31, 12), reminderRepeat: "monthly" })];
    const occ = expandOccurrences(notes, at(2026, 1, 1, 0, 0), at(2026, 5, 31, 23, 59));
    const dates = occ.map((o) => dayKey(o.at));
    expect(dates).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31"]);
  });

  it("zapisany termin już przycięty (28 lutego) wraca na dzień serii z `reminderDay`", () => {
    const notes = [makeNote({ reminder: at(2026, 2, 28, 12), reminderRepeat: "monthly", reminderDay: 31 })];
    const occ = expandOccurrences(notes, at(2026, 2, 1, 0, 0), at(2026, 4, 30, 23, 59));
    expect(occ.map((o) => dayKey(o.at))).toEqual(["2026-02-28", "2026-03-31", "2026-04-30"]);
  });

  it("seria codzienna na zakresie pięciu lat nie wiesza się i jest przycięta limitem", () => {
    const notes = [makeNote({ reminder: at(2026, 1, 1), reminderRepeat: "daily" })];
    const occ = expandOccurrences(notes, at(2026, 1, 1, 0, 0), at(2031, 1, 1, 0, 0));
    expect(occ).toHaveLength(400);
  });

  it("przejście na czas letni zachowuje godzinę lokalną", () => {
    // W Polsce zmiana czasu wypada 29 marca 2026. Godzina 9:00 ma nią zostać
    // po obu stronach — to klasyczne miejsce regresji przy liczeniu na ms.
    const notes = [makeNote({ reminder: at(2026, 3, 27, 9), reminderRepeat: "daily" })];
    const occ = expandOccurrences(notes, at(2026, 3, 27, 0, 0), at(2026, 3, 31, 23, 59));
    expect(occ.every((o) => new Date(o.at).getHours() === 9)).toBe(true);
    expect(occ.map((o) => dayKey(o.at))).toEqual([
      "2026-03-27", "2026-03-28", "2026-03-29", "2026-03-30", "2026-03-31",
    ]);
  });

  it("wynik jest posortowany po czasie, niezależnie od kolejności notatek", () => {
    const notes = [
      makeNote({ id: "pozno", reminder: at(2026, 3, 20) }),
      makeNote({ id: "wczesnie", reminder: at(2026, 3, 2) }),
      makeNote({ id: "srodek", reminder: at(2026, 3, 11) }),
    ];
    const occ = expandOccurrences(notes, MARCH.start, MARCH.end);
    expect(occ.map((o) => o.noteId)).toEqual(["wczesnie", "srodek", "pozno"]);
  });
});

describe("groupByDay", () => {
  it("grupuje po dniu lokalnym i sortuje w obrębie dnia po godzinie", () => {
    const notes = [
      makeNote({ id: "wieczor", reminder: at(2026, 3, 10, 20, 0) }),
      makeNote({ id: "rano", reminder: at(2026, 3, 10, 7, 30) }),
      makeNote({ id: "inny-dzien", reminder: at(2026, 3, 11, 9, 0) }),
    ];
    const grouped = groupByDay(expandOccurrences(notes, MARCH.start, MARCH.end));

    expect([...grouped.keys()].sort()).toEqual(["2026-03-10", "2026-03-11"]);
    expect(grouped.get("2026-03-10")!.map((o) => o.noteId)).toEqual(["rano", "wieczor"]);
  });

  it("dzień liczy się lokalnie — termin o 23:30 nie ucieka na jutro", () => {
    const late = at(2026, 3, 10, 23, 30);
    expect(dayKey(late)).toBe("2026-03-10");
  });

  it("pusta lista daje pustą mapę", () => {
    expect(groupByDay([]).size).toBe(0);
  });
});
