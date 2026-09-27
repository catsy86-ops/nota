import { describe, it, expect, beforeEach } from "vitest";
import { loadFired, saveFired, reconcileFired, FIRED_KEY } from "./firedReminders";
import type { Note } from "@/hooks/useNotes";

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "1", title: "", content: "", color: "default", pinned: false, archived: false,
    trashed: false, trashedAt: null, labels: [], reminder: null, priority: "none",
    images: [], checklist: [], folderId: null, order: 0, createdAt: 0, updatedAt: 0,
    ...overrides,
  };
}

const NOW = new Date(2026, 2, 14, 12, 0).getTime();
const HOUR = 3600_000;

describe("reconcileFired", () => {
  it("zostawia wpis, gdy termin nadal jest w przeszłości", () => {
    const notes = [makeNote({ id: "a", reminder: NOW - HOUR })];
    const { next, changed } = reconcileFired(new Set(["a"]), notes, NOW);
    expect([...next]).toEqual(["a"]);
    expect(changed).toBe(false);
  });

  it("zdejmuje wpis po przesunięciu terminu w przyszłość — przypomnienie wystrzeli ponownie", () => {
    const notes = [makeNote({ id: "a", reminder: NOW + HOUR })];
    const { next, changed } = reconcileFired(new Set(["a"]), notes, NOW);
    expect(next.size).toBe(0);
    expect(changed).toBe(true);
  });

  it("zdejmuje wpis po wyczyszczeniu terminu", () => {
    const notes = [makeNote({ id: "a", reminder: null })];
    expect(reconcileFired(new Set(["a"]), notes, NOW).next.size).toBe(0);
  });

  it("zdejmuje wpisy po nieistniejących notatkach — zbiór nie rośnie bez końca", () => {
    const notes = [makeNote({ id: "zyje", reminder: NOW - HOUR })];
    const { next, changed } = reconcileFired(new Set(["zyje", "usunieta", "inna"]), notes, NOW);
    expect([...next]).toEqual(["zyje"]);
    expect(changed).toBe(true);
  });

  it("pusty rejestr zwraca ten sam obiekt i nie zgłasza zmiany", () => {
    const fired = new Set<string>();
    const result = reconcileFired(fired, [makeNote()], NOW);
    expect(result.next).toBe(fired);
    expect(result.changed).toBe(false);
  });

  it("termin dokładnie „teraz” liczy się jako odpalony", () => {
    const notes = [makeNote({ id: "a", reminder: NOW })];
    expect([...reconcileFired(new Set(["a"]), notes, NOW).next]).toEqual(["a"]);
  });
});

describe("loadFired / saveFired", () => {
  beforeEach(() => localStorage.clear());

  it("zapisuje i odczytuje ten sam zbiór", () => {
    saveFired(new Set(["a", "b"]));
    expect([...loadFired()].sort()).toEqual(["a", "b"]);
  });

  it("brak klucza daje pusty zbiór", () => {
    expect(loadFired().size).toBe(0);
  });

  it("uszkodzona zawartość nie wywraca odczytu", () => {
    localStorage.setItem(FIRED_KEY, "{niepoprawny json");
    expect(loadFired().size).toBe(0);
  });

  it("odfiltrowuje wpisy, które nie są identyfikatorami", () => {
    localStorage.setItem(FIRED_KEY, JSON.stringify(["a", 42, null, { id: "x" }]));
    expect([...loadFired()]).toEqual(["a"]);
  });
});
