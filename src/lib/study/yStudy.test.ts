import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { cleanDump, createYStudy, dumpFromLegacy, journalRefsIn, type JournalEntry } from "./yStudy";

/** Dwa „telefony” i wymiana stanu w obie strony — jak po spotkaniu w sieci. */
function pair() {
  const docA = new Y.Doc();
  const docB = new Y.Doc();
  const sync = () => {
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA, Y.encodeStateVector(docB)));
    Y.applyUpdate(docA, Y.encodeStateAsUpdate(docB, Y.encodeStateVector(docA)));
  };
  return { a: createYStudy(docA), b: createYStudy(docB), docA, sync };
}

const entry = (id: string, at: number, over: Partial<JournalEntry> = {}): JournalEntry =>
  ({ id, at, kind: "note", topic: null, text: id, site: "", checked: [], images: [], ...over });

describe("Nauka w Yjs", () => {
  it("wpisy z dwóch telefonów scalają się bez strat, po kolei w czasie", () => {
    const { a, b, sync } = pair();
    a.addEntry(entry("z-a", 2000));
    b.addEntry(entry("z-b", 1000));
    sync();
    expect(a.get().journal.map((e) => e.id)).toEqual(["z-b", "z-a"]);
    expect(b.get().journal.map((e) => e.id)).toEqual(["z-b", "z-a"]);
  });

  it("usunięcie na jednym telefonie i Cofnij nie gubią wpisów z drugiego", () => {
    const { a, b, sync } = pair();
    a.addEntry(entry("x", 1));
    sync();
    const removed = b.removeEntry("x")!;
    a.addEntry(entry("y", 2));
    sync();
    expect(a.get().journal.map((e) => e.id)).toEqual(["y"]);
    b.restoreEntry(removed);
    sync();
    expect(a.get().journal.map((e) => e.id)).toEqual(["x", "y"]);
  });

  it("rundy sumują się między urządzeniami, najlepszy wynik to maksimum", () => {
    const { a, b, sync } = pair();
    a.recordRound("dev-a", 60, "2026-10-13", [], []);
    b.recordRound("dev-b", 90, "2026-10-14", [], []);
    b.recordRound("dev-b", 70, "2026-10-14", [], []);
    sync();
    expect(a.get()).toMatchObject({ rounds: 3, bestPercent: 90, lastDay: "2026-10-14", streak: 2 });
  });

  it("problem z tematu z „Umiem” cofa go do „W trakcie”; tablica i listy per klucz", () => {
    const { a, b, sync } = pair();
    a.setColumn("spadki", "done");
    a.setColumn("otulina", "done");
    sync();
    b.addEntry(entry("p", 1, { kind: "problem", topic: "spadki" }));
    a.setChecked("dok-1", true);
    b.setChecked("dok-2", true);
    b.recordRound("dev-b", 50, "2026-10-14", ["otulina"], [{ id: "q1", ok: false }]);
    sync();
    expect(a.get().board).toEqual({ spadki: "doing", otulina: "doing" });
    expect(a.get().checked).toEqual({ "dok-1": true, "dok-2": true });
    expect(a.get().missed).toEqual({ q1: true });
    a.setColumn("spadki", "todo");
    a.clearChecked();
    expect(a.get().board).toEqual({ otulina: "doing" });
    expect(a.get().checked).toEqual({});
  });

  it("seria liczy się z dni: przerwa ją przerywa", () => {
    const { a } = pair();
    for (const d of ["2026-10-01", "2026-10-03", "2026-10-04", "2026-10-05"]) a.recordRound("dev", 100, d, [], []);
    expect(a.get()).toMatchObject({ lastDay: "2026-10-05", streak: 3 });
  });

  it("migracja dawnego zapisu: seria → dni, rundy → urządzenie; drugi raz nic nie zmienia", () => {
    const { a, b, sync } = pair();
    b.addEntry(entry("z-drugiego", 3));
    b.setSite("Inna budowa");
    sync();
    const legacy = { journal: [entry("stary", 1), "śmieć"], rounds: 4, bestPercent: 85, streak: 3, lastDay: "2026-10-12", site: "Leśna 4", board: { spadki: "done" } };
    const dump = dumpFromLegacy(legacy, "dev-a");
    expect(dump.days.sort()).toEqual(["2026-10-10", "2026-10-11", "2026-10-12"]);
    a.mergeIn(dump, "dev-a");
    expect(a.isMerged("dev-a")).toBe(true);
    const once = a.get();
    expect(once).toMatchObject({ rounds: 4, bestPercent: 85, streak: 3, lastDay: "2026-10-12", site: "Inna budowa", board: { spadki: "done" } });
    expect(once.journal.map((e) => e.id)).toEqual(["stary", "z-drugiego"]);
    a.mergeIn(dump, "dev-a");
    expect(a.get()).toBe(once);
  });

  it("replaceAll zastępuje wszystko, a zdjęcia wpisów są widoczne dla odśmiecania", () => {
    const { a, docA } = pair();
    a.addEntry(entry("stary", 1, { images: ["a".repeat(64)] }));
    a.replaceAll(cleanDump({ journal: [entry("nowy", 2, { images: ["b".repeat(64)] })], days: ["2026-10-14"], rounds: { d: { rounds: 2, best: 50 } } }));
    expect(a.get()).toMatchObject({ rounds: 2, bestPercent: 50, streak: 1 });
    expect(a.get().journal.map((e) => e.id)).toEqual(["nowy"]);
    expect([...journalRefsIn(docA)]).toEqual(["b".repeat(64)]);
  });

  it("cleanDump odrzuca śmieci zamiast wywracać widok", () => {
    expect(cleanDump("śmieci")).toEqual({ version: 1, board: {}, checked: {}, missed: {}, journal: [], days: [], rounds: {}, site: "" });
    const d = cleanDump({ board: { a: "done", b: "todo", c: "x" }, checked: { k: true, l: 1 }, days: ["2026-10-01", "wczoraj"], rounds: { x: { rounds: -1 }, y: { rounds: 2.7, best: 140 } }, journal: [entry("ok", 1), entry("pusty", 2, { text: " " })] });
    expect(d).toMatchObject({ board: { a: "done" }, checked: { k: true }, days: ["2026-10-01"], rounds: { y: { rounds: 2, best: null } } });
    expect(d.journal.map((e) => e.id)).toEqual(["ok"]);
  });
});
