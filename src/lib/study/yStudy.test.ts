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

  it("opis rozwiązania jedzie na drugi telefon i przez kopię; nie-problem go nie ma", () => {
    const { a, b, sync } = pair();
    a.addEntry(entry("p", 1, { kind: "problem" }));
    sync();
    b.setSolution("p", "  Nowa złączka  ");
    sync();
    expect(a.get().journal[0].solution).toBe("Nowa złączka");
    a.setSolution("p", "");
    sync();
    expect(b.get().journal[0].solution).toBeUndefined();
    expect(cleanDump({ journal: [entry("p", 1, { kind: "problem", solution: " Dokręcone " })] }).journal[0].solution).toBe("Dokręcone");
    expect(cleanDump({ journal: [entry("n", 1, { solution: "x" })] }).journal[0].solution).toBeUndefined();
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

  it("migracja dawnego zapisu zachowuje zdjęcia wpisów — są widoczne dla odśmiecania (T4)", () => {
    const { a, docA } = pair();
    const photo = "c".repeat(64);
    const legacy = { journal: [entry("ze-zdjeciem", 1, { images: [photo] })], streak: 0 };
    a.mergeIn(dumpFromLegacy(legacy, "dev-a"), "dev-a");
    expect(a.get().journal[0].images).toEqual([photo]);
    expect(journalRefsIn(docA)).toContain(photo);
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
    expect(cleanDump("śmieci")).toEqual({ version: 1, board: {}, checked: {}, missed: {}, journal: [], days: [], rounds: {}, site: "", sites: {}, review: {}, boss: null, group: null, custom: {} });
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

  it("dwa telefony zmieniają różne pola tej samej karty: obie zmiany zostają (krok 2 planu Etap 6)", () => {
    const { a, b, sync } = pair();
    a.saveSite({ id: "n-3", name: "Dom", address: "", investor: "", created: 1 });
    sync();
    a.saveSite({ ...a.get().sites["n-3"], investor: "Kowalski" });
    b.saveSite({ ...b.get().sites["n-3"], address: "ul. Polna 2" });
    sync();
    expect(a.get().sites["n-3"]).toMatchObject({ investor: "Kowalski", address: "ul. Polna 2" });
    expect(b.get().sites["n-3"]).toMatchObject({ investor: "Kowalski", address: "ul. Polna 2" });
  });

  it("dwa telefony odhaczają różne punkty tego samego wpisu: oba odhaczenia zostają (krok 3 planu Etap 6)", () => {
    const { a, b, sync } = pair();
    a.addEntry(entry("odh-1", 1, { checked: ["p-1"] }));
    sync();
    a.updateEntry({ ...a.get().journal.find((e) => e.id === "odh-1")!, checked: ["p-1", "p-2"] });
    b.updateEntry({ ...b.get().journal.find((e) => e.id === "odh-1")!, checked: ["p-1", "p-3"] });
    sync();
    expect([...a.get().journal.find((e) => e.id === "odh-1")!.checked].sort()).toEqual(["p-1", "p-2", "p-3"]);
    expect([...b.get().journal.find((e) => e.id === "odh-1")!.checked].sort()).toEqual(["p-1", "p-2", "p-3"]);
  });

  it("odhaczenia zapisane jako tablica (stary zapis) czytają się i zamieniają na mapę przy zmianie", () => {
    const { a, docA } = pair();
    docA.transact(() => {
      const m = new Y.Map<unknown>();
      docA.getMap<unknown>("studyJournal").set("stary-1", m);
      m.set("id", "stary-1"); m.set("at", 1); m.set("kind", "ok"); m.set("topic", null); m.set("text", "x");
      m.set("site", ""); m.set("checked", ["p-9"]); m.set("images", []);
    });
    expect(a.get().journal.find((e) => e.id === "stary-1")!.checked).toEqual(["p-9"]);
    a.updateEntry({ ...a.get().journal.find((e) => e.id === "stary-1")!, checked: ["p-9", "p-10"] });
    expect(docA.getMap<unknown>("studyJournal").get("stary-1")).toBeInstanceOf(Y.Map);
    expect([...a.get().journal.find((e) => e.id === "stary-1")!.checked].sort()).toEqual(["p-10", "p-9"]);
  });

  it("karta zapisana starym sposobem (zwykły obiekt w mapie) nadal się czyta i przechodzi na mapę przy zapisie", () => {
    const { a, docA, sync } = pair();
    docA.getMap<unknown>("studySites").set("n-4", { id: "n-4", name: "Stara", address: "", investor: "", created: 1 });
    expect(a.get().sites["n-4"]).toMatchObject({ name: "Stara" });
    a.saveSite({ ...a.get().sites["n-4"], name: "Nowa" });
    expect(docA.getMap("studySites").get("n-4")).toBeInstanceOf(Y.Map);
    sync();
    expect(a.get().sites["n-4"]).toMatchObject({ name: "Nowa" });
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

  it("szef: zapis przechodzi na drugi telefon i do kopii, zły numer odpada", () => {
    const { a, b, sync } = pair();
    a.setBoss({ name: "Jan", phone: "48600100200" });
    sync();
    expect(b.get().boss).toEqual({ name: "Jan", phone: "48600100200" });
    const { a: c } = pair();
    c.replaceAll(a.dump());
    expect(c.get().boss?.name).toBe("Jan");
    expect(cleanDump({ boss: { name: "X", phone: "12" } }).boss).toBeNull();
    a.setGroup({ name: "Brygada", link: "https://chat.whatsapp.com/AbCdEf1234567890xyZ" });
    a.setBoss(null);
    sync();
    expect(b.get().boss).toBeNull();
    expect(b.get().group?.name).toBe("Brygada");
  });
});

describe("własne wpisy Nauki w Yjs (N5)", () => {
  const item = (id: string, text = "t") => ({ kind: "item" as const, id, topic: "system", text });

  it("własny punkt synchronizuje się na drugi telefon i wraca w kopii", () => {
    const { a, b, sync } = pair();
    a.addCustom(item("c-1", "z A"));
    sync();
    expect(b.get().custom).toEqual([item("c-1", "z A")]);
    expect(b.dump().custom).toEqual({ "c-1": item("c-1", "z A") });
  });

  it("usunięcie z jednego telefonu znika na drugim, bez ponownego pojawienia się", () => {
    const { a, b, sync } = pair();
    a.addCustom(item("c-2"));
    sync();
    a.removeCustom("c-2");
    sync();
    expect(b.get().custom).toEqual([]);
  });

  it("usunięcie zabiera powtórkę, błąd i odhaczenie wpisu", () => {
    const { a } = pair();
    a.addCustom({ kind: "question", id: "c-q", topic: "system", question: "?", correct: "a", wrong: ["b", "c", "d"], explanation: "" });
    a.recordRound("telefon", 0, "2026-10-16", [], [{ id: "c-q", ok: false }]);
    a.setChecked("c-q", true);
    a.removeCustom("c-q");
    expect(a.get().review["c-q"]).toBeUndefined();
    expect(a.get().missed["c-q"]).toBeUndefined();
    expect(a.get().checked["c-q"]).toBeUndefined();
  });

  it("przywrócenie kopii zastępuje, a scalanie nie nadpisuje własnego wpisu o tym samym id", () => {
    const { a } = pair();
    a.addCustom(item("c-3", "moje"));
    a.mergeIn(cleanDump({ custom: { "c-3": item("c-3", "obcy") , "c-4": item("c-4") } }));
    expect(a.get().custom.map((e) => e.id).sort()).toEqual(["c-3", "c-4"]);
    expect(a.get().custom.find((e) => e.id === "c-3")).toEqual(item("c-3", "moje"));
    a.replaceAll(cleanDump({ custom: { "c-5": item("c-5") } }));
    expect(a.get().custom.map((e) => e.id)).toEqual(["c-5"]);
  });
});

describe("listy karty budowy — osobne pozycje w dokumencie", () => {
  const card = (over: Partial<import("./sites").SiteCard> = {}): import("./sites").SiteCard =>
    ({ id: "k1", name: "Lipowa 5", address: "", investor: "", created: 1, ...over });
  const stages = [{ id: "woda", name: "Rozprowadzenie wody" }, { id: "proba", name: "Próba szczelności" }, { id: "odbior", name: "Odbiór" }];

  it("dwa telefony: odhaczenie etapu na jednym i usunięcie innego na drugim — oba zostają", () => {
    const { a, b, sync } = pair();
    a.saveSite(card());
    a.setSiteList("k1", "stage", stages, []);
    sync();
    const base = b.get().sites.k1.stages!;
    a.setSiteList("k1", "stage", base.map((s) => (s.id === "proba" ? { ...s, done: 500 } : s)), base);
    b.setSiteList("k1", "stage", base.filter((s) => s.id !== "odbior"), base);
    sync();
    for (const side of [a, b]) {
      expect(side.get().sites.k1.stages).toEqual([{ id: "woda", name: "Rozprowadzenie wody" }, { id: "proba", name: "Próba szczelności", done: 500 }]);
    }
  });

  it("braki: dopisanie na jednym i zmiana statusu innego na drugim — oba zostają, kolejność po dopisaniu", () => {
    const { a, b, sync } = pair();
    a.saveSite(card());
    const klej = { id: "s1", text: "Klej", qty: "", status: "missing" as const, at: 1 };
    a.setSiteList("k1", "short", [klej], []);
    sync();
    const base = b.get().sites.k1.shortages!;
    a.setSiteList("k1", "short", [...base, { id: "s2", text: "Rura", qty: "50 m", status: "missing" as const, at: 2 }], base);
    b.setSiteList("k1", "short", [{ ...klej, status: "ordered" as const, changed: 3 }], base);
    sync();
    expect(a.get().sites.k1.shortages!.map((s) => `${s.text}:${s.status}`)).toEqual(["Klej:ordered", "Rura:missing"]);
    expect(b.get().sites.k1.shortages).toEqual(a.get().sites.k1.shortages);
  });

  it("zapis bez zmian w bazie nie wskrzesza pozycji usuniętej na drugim telefonie", () => {
    const { a, b, sync } = pair();
    a.saveSite(card());
    a.setSiteList("k1", "stage", stages, []);
    sync();
    const base = a.get().sites.k1.stages!;
    b.setSiteList("k1", "stage", base.filter((s) => s.id !== "woda"), base);
    sync();
    // A nie widział jeszcze usunięcia w swojej bazie — odhacza „Odbiór” na starej liście.
    a.setSiteList("k1", "stage", base.map((s) => (s.id === "odbior" ? { ...s, done: 9 } : s)), base);
    sync();
    expect(a.get().sites.k1.stages!.map((s) => s.id)).toEqual(["proba", "odbior"]);
  });

  it("dawne pola karty: czytane bez zmian, przy pierwszym zapisie przechodzą do mapy, a karta je traci", () => {
    const { a, docA } = pair();
    a.saveSite(card());
    // Karta zapisana przez starszą wersję aplikacji — listy w polach karty.
    docA.getMap("studySites").set("k1", card({ stages: [{ id: "woda", name: "Woda", done: 4 }], shortages: [{ id: "s1", text: "Klej", qty: "", status: "missing", at: 1 }] }));
    expect(a.get().sites.k1.stages).toEqual([{ id: "woda", name: "Woda", done: 4 }]);
    a.setSiteList("k1", "short", [], a.get().sites.k1.shortages!);
    expect(a.get().sites.k1.shortages).toEqual([]);
    expect(a.get().sites.k1.stages).toEqual([{ id: "woda", name: "Woda", done: 4 }]);
    expect(docA.getMap("studySites").get("k1")).not.toHaveProperty("stages");
    expect(docA.getMap("studySites").get("k1")).not.toHaveProperty("shortages");
  });

  it("zapis karty (nazwa, adres) nie rusza list; kopia zapasowa: listy w kartach i z powrotem do mapy", () => {
    const { a } = pair();
    a.saveSite(card());
    a.setSiteList("k1", "stage", stages, []);
    a.setSiteList("k1", "order", [{ at: 5, items: [{ name: "Kolano 16", qty: 2 }] }], []);
    const projected = a.get().sites.k1;
    a.saveSite({ ...projected, address: "ul. Lipowa 5" });
    expect(a.get().sites.k1.stages).toHaveLength(3);
    const dump = a.dump();
    expect(dump.sites.k1.orders).toEqual([{ at: 5, items: [{ name: "Kolano 16", qty: 2 }] }]);
    const { b } = pair();
    b.replaceAll(dump);
    expect(b.get().sites.k1.stages!.map((s) => s.id)).toEqual(["woda", "proba", "odbior"]);
    expect(b.get().sites.k1.address).toBe("ul. Lipowa 5");
    expect(b.get().sites.k1.orders).toHaveLength(1);
  });

  it("usunięte wszystkie etapy zostają pustą listą, nie wracają domyślne", () => {
    const { a } = pair();
    a.saveSite(card());
    a.setSiteList("k1", "stage", stages, []);
    a.setSiteList("k1", "stage", [], a.get().sites.k1.stages!);
    expect(a.get().sites.k1.stages).toEqual([]);
  });
});

describe("dokumenty budowy w dokumencie", () => {
  const H = (c: string) => c.repeat(64);
  it("odniesienia: dokumenty chronione przed sprzątaniem; duży PDF nie jedzie do innego urządzenia", () => {
    const doc = new Y.Doc();
    const s = createYStudy(doc);
    s.saveSite({ id: "a", name: "Lipowa", address: "", investor: "", created: 1 });
    s.setSiteList("a", "docs", [
      { id: H("1"), name: "rzut.jpg", size: 5 * 1024 * 1024, type: "image/jpeg", at: 1 },
      { id: H("2"), name: "maly.pdf", size: 1000, type: "application/pdf", at: 2 },
      { id: H("3"), name: "duzy.pdf", size: 5 * 1024 * 1024, type: "application/pdf", at: 3 },
    ], []);
    expect([...journalRefsIn(doc)].sort()).toEqual([H("1"), H("2"), H("3")]);
    expect([...journalRefsIn(doc, true)].sort()).toEqual([H("1"), H("2")]);
    expect(s.get().sites.a.docs?.map((d) => d.name)).toEqual(["rzut.jpg", "maly.pdf", "duzy.pdf"]);
  });
});

describe("Nauka — wpis jako mapa pól (D5)", () => {
  it("edycja różnych pól tego samego wpisu na dwóch telefonach scala się bez strat", () => {
    const { a, b, sync } = pair();
    a.addEntry(entry("w", 1, { kind: "problem", topic: "t1", text: "stary tekst" }));
    sync();
    // Telefon A zmienia tekst, telefon B rozwiązuje problem — równocześnie, bez synchronizacji.
    a.updateEntry({ ...a.get().journal.find((e) => e.id === "w")!, text: "nowy tekst" });
    b.setResolved("w", 555);
    sync();
    for (const s of [a, b]) {
      const w = s.get().journal.find((e) => e.id === "w")!;
      expect(w.text).toBe("nowy tekst");
      expect(w.resolved).toBe(555);
    }
  });

  it("usunięte pole znika z wpisu (np. cofnięte rozwiązanie)", () => {
    const { a, b, sync } = pair();
    a.addEntry(entry("p", 1, { kind: "problem", resolved: 7 }));
    sync();
    a.setResolved("p", null);
    sync();
    expect(b.get().journal.find((e) => e.id === "p")!.resolved).toBeUndefined();
  });

  it("starszy zapis (zwykły obiekt w dokumencie) czyta się i przy edycji zamienia na mapę pól", () => {
    const doc = new Y.Doc();
    doc.getMap("studyJournal").set("old", entry("old", 1, { text: "sprzed D5" }));
    const s = createYStudy(doc);
    expect(s.get().journal.find((e) => e.id === "old")?.text).toBe("sprzed D5");
    s.updateEntry({ ...s.get().journal.find((e) => e.id === "old")!, text: "po edycji" });
    expect(doc.getMap("studyJournal").get("old")).toBeInstanceOf(Y.Map);
    expect(s.get().journal.find((e) => e.id === "old")?.text).toBe("po edycji");
  });

  it("kopia zapasowa nadal zawiera wpis jako zwykły obiekt (format bez zmian)", () => {
    const { a } = pair();
    a.addEntry(entry("k", 1, { checked: ["c1"] }));
    const d = a.dump();
    expect(d.journal.find((e) => e.id === "k")).toMatchObject({ id: "k", checked: ["c1"] });
  });
});

describe("zapis wpisu a pola z nowszej wersji", () => {
  it("pole nieznane tej wersji zostaje przy zapisie wpisu bez niego", () => {
    const doc = new Y.Doc();
    const study = createYStudy(doc);
    const entry = { id: "w1", at: 1_700_000_000_000, kind: "ok", topic: null, text: "Montaż", site: "Lipowa 9", checked: [], images: [] } as unknown as JournalEntry;
    study.addEntry(entry);
    (doc.getMap("studyJournal").get("w1") as Y.Map<unknown>).set("przyszlePole", 42);
    study.updateEntry({ ...entry, text: "Montaż poprawiony" });
    const map = doc.getMap("studyJournal").get("w1") as Y.Map<unknown>;
    expect(map.get("przyszlePole")).toBe(42);
    expect(map.get("text")).toBe("Montaż poprawiony");
  });

  it("znane pole usunięte z wpisu nadal znika", () => {
    const doc = new Y.Doc();
    const study = createYStudy(doc);
    const entry = { id: "w2", at: 1_700_000_000_000, kind: "ok", topic: null, text: "A", site: "X", checked: [], images: [], solution: "naprawione" } as unknown as JournalEntry;
    study.addEntry(entry);
    const { solution: _s, ...without } = entry as JournalEntry & { solution?: string };
    study.updateEntry(without as JournalEntry);
    expect((doc.getMap("studyJournal").get("w2") as Y.Map<unknown>).has("solution")).toBe(false);
  });
});
