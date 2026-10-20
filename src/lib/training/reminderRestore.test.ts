import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { createYTraining } from "./yTraining";

// Przegląd 2026-10-20: H2 (przywracanie kopii), M1–M3 (osierocone notatki, pusta godzina).
describe("przypomnienie treningu — zapis i przywracanie", () => {
  it("M2/M3: pusta albo zła godzina nie trafia do dokumentu", () => {
    const y = createYTraining(new Y.Doc());
    y.setReminder({ time: "" });
    expect(y.getReminder()).toBeNull();
    y.setReminder({ time: "25:99", noteId: "n1" });
    expect(y.getReminder()).toBeNull();
    y.setReminder({ time: "18:00", noteId: "n1" });
    expect(y.getReminder()).toEqual({ time: "18:00", noteId: "n1" });
  });

  it("H2: przypomnienie lokalne, którego notatki już nie ma, znika przy przywracaniu", () => {
    const y = createYTraining(new Y.Doc());
    y.setReminder({ time: "18:00", noteId: "stara-notatka" });
    // Kopia bez tej notatki (po przywróceniu notatek z pliku ona już nie istnieje).
    y.mergeDump({ entries: [], plans: [], reminder: null }, (id) => id === "inna");
    expect(y.getReminder()).toBeNull();
  });

  it("H2: przypomnienie z kopii trafia na telefon, gdy jego notatka istnieje po przywróceniu", () => {
    const y = createYTraining(new Y.Doc());
    y.mergeDump({ entries: [], plans: [], reminder: { time: "19:00", noteId: "z-kopii" } }, (id) => id === "z-kopii");
    expect(y.getReminder()).toEqual({ time: "19:00", noteId: "z-kopii" });
  });

  it("H2: przypomnienie z kopii bez swojej notatki nie jest dokładane", () => {
    const y = createYTraining(new Y.Doc());
    y.mergeDump({ entries: [], plans: [], reminder: { time: "19:00", noteId: "brak" } }, () => false);
    expect(y.getReminder()).toBeNull();
  });

  it("żywe przypomnienie lokalne nie jest nadpisywane przypomnieniem z kopii", () => {
    const y = createYTraining(new Y.Doc());
    y.setReminder({ time: "18:00", noteId: "moja" });
    y.mergeDump({ entries: [], plans: [], reminder: { time: "07:00", noteId: "z-kopii" } }, () => true);
    expect(y.getReminder()).toEqual({ time: "18:00", noteId: "moja" });
  });
});
