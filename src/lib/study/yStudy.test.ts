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

  it("rozwiązanie problemu przechodzi na drugi telefon; cleanEntry trzyma je tylko przy problemie", () => {
    const { a, b, sync } = pair();
    a.addEntry(entry("p", 1, { kind: "problem" }));
    sync();
    b.setResolved("p", 500);
    sync();
    expect(a.get().journal[0].resolved).toBe(500);
    a.setResolved("p", null);
    sync();
    expect(b.get().journal[0].resolved).toBeUndefined();
    expect(cleanDump({ journal: [entry("n", 1, { resolved: 3 })] }).journal[0].resolved).toBeUndefined();
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
    expect(cleanDump("śmieci")).toEqual({ version: 1, board: {}, checked: {}, missed: {}, journal: [], days: [], rounds: {}, site: "", sites: {}, review: {} });
    const d = cleanDump({ board: { a: "done", b: "todo", c: "x" }, checked: { k: true, l: 1 }, days: ["2026-10-01", "wczoraj"], rounds: { x: { rounds: -1 }, y: { rounds: 2.7, best: 140 } }, journal: [entry("ok", 1), entry("pusty", 2, { text: " " })] });
    expect(d).toMatchObject({ board: { a: "done" }, checked: { k: true }, days: ["2026-10-01"], rounds: { y: { rounds: 2, best: null } } });
    expect(d.journal.map((e) => e.id)).toEqual(["ok"]);
  });
});

describe("karty budów w Yjs", () => {
  it("ta sama nowa budowa z dwóch telefonów to jedna karta; zmiana nazwy przechodzi na drugi", () => {
    const { a, b, sync } = pair();
    const card = (name: string, created: number) => ({ id: "n-1", name, address: "", investor: "", created });
    a.addEntry(entry("z-a", 1, { site: "Lipowa 5", siteId: "n-1" }), card("Lipowa 5", 1));
    b.addEntry(entry("z-b", 2, { site: "Lipowa 5", siteId: "n-1" }), card("Lipowa 5", 2));
    sync();
    expect(Object.keys(a.get().sites)).toEqual(["n-1"]);
    b.saveSite({ ...b.get().sites["n-1"], name: "Dom Nowaków", address: "ul. Lipowa 5" });
    sync();
    expect(a.get().sites["n-1"]).toMatchObject({ name: "Dom Nowaków", address: "ul. Lipowa 5" });
    expect(a.get().journal.map((e) => e.siteId)).toEqual(["n-1", "n-1"]);
  });

  it("kopia: karty w zrzucie, śmieci odpadają, replaceAll i mergeIn je przenoszą", () => {
    const d = cleanDump({ sites: { ok: { id: "ok", name: " Polna ", created: 3 }, zly: { id: "inny", name: "x" }, pusty: { id: "pusty", name: "  " } } });
    expect(d.sites).toEqual({ ok: { id: "ok", name: "Polna", address: "", investor: "", created: 3 } });
    const { a, b } = pair();
    a.replaceAll(d);
    expect(a.dump().sites.ok.name).toBe("Polna");
    b.saveSite({ id: "ok", name: "Moja", address: "", investor: "", created: 1 });
    b.mergeIn(d);
    expect(b.get().sites.ok.name).toBe("Moja");
  });

  it("runda ustawia terminy powtórek; dwa telefony scalają różne pytania, kopia je przenosi", () => {
    const { a, b, sync } = pair();
    a.recordRound("tel-a", 50, "2026-10-15", [], [{ id: "q1", ok: true }, { id: "q2", ok: false }]);
    b.recordRound("tel-b", 100, "2026-10-15", [], [{ id: "q3", ok: true }]);
    sync();
    const r = b.get().review;
    expect(Object.keys(r).sort()).toEqual(["q1", "q2", "q3"]);
    expect(r.q1).toMatchObject({ reps: 1, due: "2026-10-16" });
    expect(r.q2).toMatchObject({ reps: 0, lapses: 1, due: "2026-10-16" });
    const dump = a.dump();
    const { a: c } = pair();
    c.replaceAll(dump);
    expect(c.get().review.q2.lapses).toBe(1);
    // Scalanie starszej karty nie cofa nowszej.
    a.recordRound("tel-a", 100, "2026-10-16", [], [{ id: "q2", ok: true }]);
    a.mergeIn({ ...dump, review: { q2: { ...dump.review.q2 } } });
    expect(a.get().review.q2.last).toBe("2026-10-16");
  });
});
