import { describe, it, expect } from "vitest";
import type { Note } from "@/hooks/useNotes";
import { buildWeeklyReview, reviewCycleKey, dueCycleKey, snoozeUntilTomorrow, reviewQueue } from "./weeklyReview";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 8, 27, 19, 0).getTime(); // niedziela wieczorem

let seq = 0;
const note = (o: Partial<Note> = {}): Note => ({
  id: `n${++seq}`, title: "Notatka", content: "", color: "default", pinned: false, archived: false,
  trashed: false, trashedAt: null, labels: ["x"], reminder: null, priority: "none", images: [],
  checklist: [], folderId: "f", order: 0, createdAt: NOW, updatedAt: NOW, ...o,
});
const cat = (notes: Note[], key: string) => buildWeeklyReview(notes, NOW).categories.find((c) => c.key === key);

describe("buildWeeklyReview", () => {
  it("nic do przeglądu: pusta lista kategorii", () => {
    const r = buildWeeklyReview([note(), note({ updatedAt: NOW - 3 * DAY })], NOW);
    expect(r.categories).toEqual([]);
    expect(r.total).toBe(0);
  });

  it("nietknięte od 30 dni: bez przypiętych, zarchiwizowanych i z kosza", () => {
    const old = NOW - 31 * DAY;
    const notes = [
      note({ updatedAt: old }),
      note({ updatedAt: NOW - 30 * DAY }),
      note({ updatedAt: old, pinned: true }),
      note({ updatedAt: old, archived: true }),
      note({ updatedAt: old, trashed: true }),
      note({ updatedAt: NOW - 29 * DAY }),
    ];
    expect(cat(notes, "stale")?.count).toBe(2);
  });

  it("listy z nieodhaczonymi pozycjami nieruszane od 7 dni", () => {
    const items = (checked: boolean) => [{ id: "a", text: "a", checked }];
    const notes = [
      note({ checklist: items(false), updatedAt: NOW - 8 * DAY }),
      note({ checklist: items(true), updatedAt: NOW - 8 * DAY }),
      note({ checklist: items(false), updatedAt: NOW - 2 * DAY }),
      note({ checklist: items(false), updatedAt: NOW - 8 * DAY, archived: true }),
    ];
    expect(cat(notes, "openLists")?.count).toBe(1);
  });

  it("przeterminowane przypomnienia, najstarsze pierwsze", () => {
    const a = note({ reminder: NOW - DAY });
    const b = note({ reminder: NOW - 5 * DAY });
    const c = note({ reminder: NOW + DAY });
    const r = cat([a, b, c], "overdue");
    expect(r?.notes.map((n) => n.id)).toEqual([b.id, a.id]);
  });

  it("do posegregowania: bez folderu i etykiet, bez notatek dnia i pustych", () => {
    const notes = [
      note({ folderId: null, labels: [] }),
      note({ folderId: null, labels: ["x"] }),
      note({ folderId: "f", labels: [] }),
      note({ folderId: null, labels: [], dailyDate: "2026-09-27" }),
      note({ folderId: null, labels: [], title: "", content: "" }),
    ];
    expect(cat(notes, "unsorted")?.count).toBe(1);
  });

  it("licznik pełny, przykłady maksymalnie 5; total liczy notatkę raz", () => {
    const many = Array.from({ length: 8 }, (_, i) => note({ reminder: NOW - (i + 1) * DAY, folderId: null, labels: [] }));
    const r = buildWeeklyReview(many, NOW);
    const overdue = r.categories.find((c) => c.key === "overdue")!;
    expect(overdue.count).toBe(8);
    expect(overdue.examples).toHaveLength(5);
    expect(r.total).toBe(8);
    expect(reviewQueue(r)).toHaveLength(8);
  });
});

describe("okno przeglądu", () => {
  it("niedziela od 17:00 i poniedziałek do 12:00", () => {
    const at = (d: number, h: number, m = 0) => new Date(2026, 8, d, h, m).getTime();
    expect(reviewCycleKey(at(27, 16, 59), 0)).toBeNull();
    expect(reviewCycleKey(at(27, 17), 0)).toBe("2026-09-27");
    expect(reviewCycleKey(at(28, 8), 0)).toBe("2026-09-27");
    expect(reviewCycleKey(at(28, 11, 59), 0)).toBe("2026-09-27");
    expect(reviewCycleKey(at(28, 12), 0)).toBeNull();
    expect(reviewCycleKey(at(29, 9), 0)).toBeNull();
  });

  it("inny dzień tygodnia", () => {
    expect(reviewCycleKey(new Date(2026, 8, 25, 20).getTime(), 5)).toBe("2026-09-25");
    expect(reviewCycleKey(new Date(2026, 8, 27, 20).getTime(), 5)).toBeNull();
  });

  it("wyłączony, odłożony i zamknięty cykl nie są należne", () => {
    const base = { day: 0, snoozeUntil: 0, closedKey: null as string | null };
    expect(dueCycleKey(NOW, base)).toBe("2026-09-27");
    expect(dueCycleKey(NOW, { ...base, day: null })).toBeNull();
    expect(dueCycleKey(NOW, { ...base, closedKey: "2026-09-27" })).toBeNull();
    expect(dueCycleKey(NOW, { ...base, snoozeUntil: snoozeUntilTomorrow(NOW) })).toBeNull();
  });

  it("odłożone na jutro wraca w poniedziałek rano", () => {
    const snooze = snoozeUntilTomorrow(NOW);
    const monday8 = new Date(2026, 8, 28, 8).getTime();
    expect(dueCycleKey(monday8, { day: 0, snoozeUntil: snooze, closedKey: null })).toBe("2026-09-27");
  });
});
