import { describe, it, expect } from "vitest";
import { groupReminders, snoozeTimes, countOverdue, countDueToday, eveningTime, sortArchivedByReminder } from "./reminderAgenda";
import { weekSeriesForecasts } from "@/lib/reminderForecast";
import type { Note } from "@/hooks/useNotes";

const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const note = (id: string, reminder: number | null, updatedAt = 0): Note => ({
  id, title: id, content: "", color: "default", pinned: false, archived: false, trashed: false, trashedAt: null,
  labels: [], reminder, priority: "none", images: [], checklist: [], folderId: null, order: 0, createdAt: 0, updatedAt,
});

const NOW = at(2026, 9, 28, 12);

describe("groupReminders", () => {
  it("cały dzień (D-1): termin z rana to „Dziś”, nie „Zaległe” o 12:00, i nie liczy się jako zaległy", () => {
    const morning = at(2026, 9, 28, 9);
    const allDay = { ...note("cały-dzień", morning), reminderAllDay: true };
    const groups = groupReminders([allDay], NOW);
    expect(groups.map((g) => [g.key, g.notes.map((n) => n.id)])).toEqual([["today", ["cały-dzień"]]]);
    expect(countOverdue([allDay], NOW)).toBe(0);
    // Ten sam termin bez flagi dalej jest zaległy.
    expect(countOverdue([note("zwykły", morning)], NOW)).toBe(1);
    // Cały dzień z wczoraj jest zaległy.
    expect(countOverdue([{ ...note("wczoraj", at(2026, 9, 27, 9)), reminderAllDay: true }], NOW)).toBe(1);
  });

  it("zaległe w ostatniej godzinie zostają w „Zaległe”, starsze idą do „Przegapione”", () => {
    const groups = groupReminders([note("przed-chwila", NOW - 30 * 60_000), note("godzinę-temu", NOW - 60 * 60_000 - 1)], NOW);
    expect(groups.map((g) => [g.key, g.notes.map((n) => n.id)])).toEqual([
      ["overdue", ["przed-chwila"]],
      ["missed", ["godzinę-temu"]],
    ]);
  });

  it("groups by due date and sorts by reminder, ignoring edit time", () => {
    const groups = groupReminders([
      note("pozniej", at(2026, 11, 1), 999),
      note("jutro", at(2026, 9, 29, 8), 1),
      note("zalegle", at(2026, 9, 1), 5),
      note("dzis-wieczorem", at(2026, 9, 28, 20)),
      note("zalegle-dzis-rano", at(2026, 9, 28, 8)),
      note("bez-terminu", null),
    ], NOW);
    expect(groups.map((g) => [g.key, g.notes.map((n) => n.id)])).toEqual([
      // Zaległe starsze niż godzina (serwer push ich już nie dośle) idą do „Przegapione”.
      ["missed", ["zalegle", "zalegle-dzis-rano"]],
      ["today", ["dzis-wieczorem"]],
      ["week", ["jutro"]],
      ["later", ["pozniej"]],
    ]);
  });

  it("puts the end of the 7th day into the week group and skips empty groups", () => {
    const groups = groupReminders([note("d7", at(2026, 10, 5, 23, 30)), note("d8", at(2026, 10, 6, 0, 1))], NOW);
    expect(groups.map((g) => [g.key, g.notes.map((n) => n.id)])).toEqual([["week", ["d7"]], ["later", ["d8"]]]);
  });
});

describe("weekSeriesForecasts", () => {
  const series = (id: string, reminder: number): Note => ({ ...note(id, reminder), reminderRepeat: "daily" });
  // 28 października: okno prognozy to 29 października – 4 listopada.
  const TODAY = at(2026, 10, 28, 12);

  it("liczy wystąpienia serii w 7 dniach poza zapisanym terminem, jednorazowe pomija", () => {
    const forecasts = weekSeriesForecasts([
      series("seria-jutro", at(2026, 10, 29, 9)), // zapisany 29, w oknie 30 – 4 listopada: 6 prognoz
      series("seria-zalegla", at(2026, 10, 26, 9)), // zaległy zapisany termin, w oknie 29 – 4 listopada: 7 prognoz
      note("jednorazowe", at(2026, 10, 29, 9)),
      series("seria-dalej", at(2026, 11, 10, 9)), // poza oknem
    ], TODAY);
    // Kolejność: wg pierwszego wystąpienia w oknie (29 października przed 30.).
    expect(forecasts).toEqual([
      { noteId: "seria-zalegla", title: "seria-zalegla", count: 7 },
      { noteId: "seria-jutro", title: "seria-jutro", count: 6 },
    ]);
  });

  it("pomija kosz i serie bez wystąpień w oknie", () => {
    const trashed = { ...series("kosz", at(2026, 10, 29, 9)), trashed: true };
    expect(weekSeriesForecasts([trashed], TODAY)).toEqual([]);
  });
});

describe("snoozeTimes", () => {
  it("gives +10 minutes and tomorrow at 9:00", () => {
    const { in10min, tomorrow9 } = snoozeTimes(at(2026, 9, 30, 23, 55));
    expect(in10min).toBe(at(2026, 10, 1, 0, 5));
    expect(tomorrow9).toBe(at(2026, 10, 1, 9, 0));
  });
});

describe("reminderAgenda — pusta lista i odłożenie o godzinę (faza 1 Przypomnień)", () => {
  it("pusta lista daje puste grupy, a liczba zaległych to zero", () => {
    expect(groupReminders([]).every((g) => g.notes.length === 0)).toBe(true);
    expect(countOverdue([])).toBe(0);
  });

  it("odłożenie o godzinę liczy się od teraz, nie od północy", () => {
    const now = at(2026, 10, 1, 14, 20);
    expect(snoozeTimes(now).inHour).toBe(at(2026, 10, 1, 15, 20));
  });

  it("countDueToday: zaległe i dzisiejsze, bez przyszłych i kosza; archiwum liczy się", () => {
    const now = at(2026, 10, 20, 12);
    const trashed = { ...note("bin", now - 60_000), trashed: true };
    const archived = { ...note("arch", now - 60_000), archived: true };
    const notes = [
      note("late", now - 3 * 3600_000), // przegapione
      note("soon", now + 3600_000), // dziś
      note("week", now + 3 * 86_400_000), // tydzień — nie na Dziś
      trashed,
      archived,
    ];
    expect(countDueToday(notes, now)).toBe(3);
  });
});

describe("sortArchivedByReminder (T 1.6)", () => {
  it("z terminem rosnąco, bez terminu na końcu, bez zmiany oryginału", () => {
    const a = note("bez", null);
    const b = note("późny", at(2026, 11, 1));
    const c = note("wczesny", at(2026, 10, 30));
    const input = [a, b, c];
    expect(sortArchivedByReminder(input).map((n) => n.id)).toEqual(["wczesny", "późny", "bez"]);
    expect(input.map((n) => n.id)).toEqual(["bez", "późny", "wczesny"]);
  });
});

describe("eveningTime (T-4 / 2.1)", () => {
  it("„Wieczorem” to 18:00 do 17:30, potem znika", () => {
    expect(eveningTime(at(2026, 10, 19, 12))).toBe(at(2026, 10, 19, 18));
    expect(eveningTime(at(2026, 10, 19, 17, 29))).toBe(at(2026, 10, 19, 18));
    expect(eveningTime(at(2026, 10, 19, 17, 30))).toBeNull();
    expect(eveningTime(at(2026, 10, 19, 23))).toBeNull();
  });
});
