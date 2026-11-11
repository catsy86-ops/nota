import { describe, expect, it } from "vitest";
import { mergeEdit } from "./editMerge";
import { addJournalEntry, updateJournalEntry } from "./journalActions";
import { getStudy } from "./store";
import { yStudy } from "./data";
import type { JournalEntry } from "./journalEntry";

const e = (extra: Partial<JournalEntry> = {}): JournalEntry =>
  ({ id: "x", at: 1, kind: "ok", topic: null, text: "a", site: "S", checked: [], images: [], ...extra });

describe("mergeEdit (W4)", () => {
  it("nietknięte pola zostają takie, jak zmienił je drugi telefon; zmienione w arkuszu wygrywają", () => {
    const base = e({ text: "a", solution: undefined, images: ["i1"] });
    const mine = e({ text: "a – poprawka", images: ["i1"] }); // użytkownik zmienił tylko tekst
    const current = e({ text: "a", images: ["i1", "i2"], stage: "etap-1" }); // drugi telefon dodał zdjęcie i etap
    const out = mergeEdit(base, mine, current);
    expect(out.text).toBe("a – poprawka");
    expect(out.images).toEqual(["i1", "i2"]);
    expect(out.stage).toBe("etap-1");
  });

  it("pole zmienione po obu stronach: wygrywa arkusz; usunięte w arkuszu zostaje usunięte", () => {
    const base = e({ text: "a", due: "2026-11-20" });
    const mine = e({ text: "moje" }); // due usunięte w arkuszu
    const current = e({ text: "cudze", due: "2026-11-20" });
    const out = mergeEdit(base, mine, current);
    expect(out.text).toBe("moje");
    expect(out).not.toHaveProperty("due");
  });

  it("kolejność kluczy w obiektach nie wpływa na porównanie; bez bazy wygrywa formularz", () => {
    const base = e({ captions: { a: "1", b: "2" } });
    const mine = e({ captions: { b: "2", a: "1" } });
    const current = e({ captions: { a: "1", b: "2", c: "3" } });
    expect(mergeEdit(base, mine, current).captions).toEqual({ a: "1", b: "2", c: "3" });
    expect(mergeEdit(undefined, mine, current)).toBe(mine);
  });
});

describe("updateJournalEntry z bazą (W4)", () => {
  it("zapis edycji nie cofa zmiany wprowadzonej w dokumencie w trakcie edycji", () => {
    const now = Date.UTC(2026, 10, 11, 12);
    const created = addJournalEntry({ kind: "ok", topic: null, text: "start", site: "Dom Wójcik" }, now)!;
    const base = getStudy().journal.find((x) => x.id === created.id)!;
    // „drugi telefon” zmienia tekst, gdy arkusz jest otwarty
    yStudy.updateEntry({ ...base, text: "z drugiego telefonu" });
    // użytkownik edytuje tylko typ wpisu
    updateJournalEntry(created.id, { kind: "note", topic: null, text: "start", site: "Dom Wójcik", at: base.at, resolved: null, base }, now + 10);
    const saved = getStudy().journal.find((x) => x.id === created.id)!;
    expect(saved.kind).toBe("note");
    expect(saved.text).toBe("z drugiego telefonu");
  });
});
