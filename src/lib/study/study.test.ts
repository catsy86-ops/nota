import { describe, it, expect, beforeEach } from "vitest";
import { CHECKLIST, QUESTIONS, TOPICS } from "./content";
import { buildRound, missedTopics, scoreRound } from "./quiz";
import { topicToNote } from "./toNote";
import { journalImageRefs } from "./images";
import { clearJournalDraft, getJournalDraft, patchJournalDraft, sanitizeDraft, setJournalDraftTopic, EMPTY_DRAFT } from "./draft";
import { dayLabel, entriesPl, filterJournal, fromLocalInput, groupJournal, NO_FILTER, suggestSites, problemsPl, splitRecent, toLocalInput, whenLabel } from "./journalView";
import { entrySiteId, findSiteByName, resolveSite, siteDirectory, siteKey } from "./sites";
import { closeJournalSheet, getJournalEditForm, openJournalEdit, patchJournalEditForm } from "./entrySheet";
import {
  sanitizeStudy, moveTopic, recordRound, activeStreak, toggleChecked, getStudy, columnOf, resetChecklist,
  addJournalEntry, removeJournalEntry, restoreJournalEntry, setSite, practiceByTopic,
  updateJournalEntry, setProblemResolved, openProblems, saveSiteCard, setSiteArchived,
} from "./store";
import { resetStudyForTests, yStudy } from "./data";
import { yjsStore } from "@/lib/yjsStore";

/** Nauka żyje w dokumencie Yjs — każdy test zaczyna od pustego. */
async function freshStudy() {
  localStorage.clear();
  await yjsStore.resetForTests();
  resetStudyForTests();
}

const seeded = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

describe("treść", () => {
  it("każde pytanie i punkt listy wskazuje istniejący temat; id są unikalne", () => {
    const ids = new Set(TOPICS.map((t) => t.id));
    expect(ids.size).toBe(TOPICS.length);
    for (const q of QUESTIONS) expect(ids.has(q.topic), q.id).toBe(true);
    for (const c of CHECKLIST) expect(ids.has(c.topic), c.id).toBe(true);
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(QUESTIONS.length);
    expect(new Set(CHECKLIST.map((c) => c.id)).size).toBe(CHECKLIST.length);
  });

  it("każdy temat ma pytanie i punkt listy, a opcje pytań są różne", () => {
    for (const t of TOPICS) {
      expect(QUESTIONS.some((q) => q.topic === t.id), t.id).toBe(true);
      expect(CHECKLIST.some((c) => c.topic === t.id), t.id).toBe(true);
    }
    for (const q of QUESTIONS) expect(new Set(q.options).size, q.id).toBe(4);
  });
});

describe("buildRound", () => {
  it("losuje bez powtórzeń i poprawnie wskazuje właściwą odpowiedź", () => {
    const round = buildRound(10, new Set(), seeded(7));
    expect(round).toHaveLength(10);
    expect(new Set(round.map((q) => q.id)).size).toBe(10);
    for (const rq of round) {
      const src = QUESTIONS.find((q) => q.id === rq.id)!;
      expect(rq.options[rq.correct]).toBe(src.options[0]);
      expect([...rq.options].sort()).toEqual([...src.options].sort());
    }
  });

  it("daje pierwszeństwo tematom, których jeszcze nie umiesz", () => {
    const weak = ["spadki", "napowietrzanie", "proba-kan", "uszczelki"];
    const round = buildRound(4, new Set(weak), seeded(3));
    expect(round.every((q) => weak.includes(q.topic))).toBe(true);
  });

  it("liczy wynik i tematy z błędami", () => {
    const round = buildRound(3, new Set(), seeded(1));
    const answers = [round[0].correct, (round[1].correct + 1) % 4, null];
    expect(scoreRound(round, answers)).toBe(1);
    expect(missedTopics(round, answers)).toEqual([...new Set([round[1].topic, round[2].topic])]);
  });
});

describe("store", () => {
  beforeEach(freshStudy);

  it("sanitizeStudy odrzuca nieznane tematy i złe wartości", () => {
    const d = { board: {}, checked: {}, bestPercent: null, rounds: 0, missed: {}, journal: [], site: "", sites: {}, streak: 0, lastDay: null };
    expect(sanitizeStudy(d, "śmieci")).toEqual(d);
    const s = sanitizeStudy(d, { board: { spadki: "done", obcy: "done", system: "x" }, checked: { "dok-1": true, a: 1 }, bestPercent: 140, rounds: -2, missed: { "q-pion": true, obce: true } });
    expect(s).toEqual({ board: { spadki: "done" }, checked: { "dok-1": true }, bestPercent: null, rounds: 0, missed: { "q-pion": true }, journal: [], site: "", sites: {}, streak: 0, lastDay: null });
    expect(sanitizeStudy(d, { streak: 4, lastDay: "2026-10-11" })).toMatchObject({ streak: 4, lastDay: "2026-10-11" });
    expect(sanitizeStudy(d, { streak: 4, lastDay: "wczoraj" })).toMatchObject({ streak: 0, lastDay: null });
  });

  it("przenosi tematy, odhacza punkty i resetuje listę", () => {
    moveTopic("spadki", "doing");
    expect(columnOf(getStudy(), "spadki")).toBe("doing");
    moveTopic("spadki", "todo");
    expect(columnOf(getStudy(), "spadki")).toBe("todo");
    toggleChecked("dok-1");
    expect(getStudy().checked["dok-1"]).toBe(true);
    toggleChecked("dok-1");
    expect(getStudy().checked["dok-1"]).toBeUndefined();
    toggleChecked("dok-2");
    resetChecklist();
    expect(getStudy().checked).toEqual({});
  });

  it("recordRound zapisuje najlepszy wynik i cofa błędne tematy z „Umiem”", () => {
    moveTopic("spadki", "done");
    moveTopic("system", "done");
    const r1 = recordRound(7, 10, ["spadki", "podtynk"]);
    expect(r1.demoted).toEqual(["spadki"]);
    expect(columnOf(getStudy(), "spadki")).toBe("doing");
    expect(columnOf(getStudy(), "system")).toBe("done");
    expect(columnOf(getStudy(), "podtynk")).toBe("todo");
    recordRound(5, 10, []);
    expect(getStudy()).toMatchObject({ bestPercent: 70, rounds: 2 });
  });

  it("recordRound pamięta błędne pytania i czyści je po dobrej odpowiedzi", () => {
    recordRound(1, 2, ["spadki"], [{ id: "q-spadek", ok: false }, { id: "q-pion", ok: true }]);
    expect(getStudy().missed).toEqual({ "q-spadek": true });
    recordRound(1, 1, [], [{ id: "q-spadek", ok: true }]);
    expect(getStudy().missed).toEqual({});
  });

  it("recordRound liczy serię dni: dzień po dniu rośnie, ten sam dzień nie, przerwa zeruje", () => {
    expect(recordRound(1, 1, [], [], "2026-10-30")).toMatchObject({ streak: 1, streakGrew: true });
    expect(recordRound(1, 1, [], [], "2026-10-30")).toMatchObject({ streak: 1, streakGrew: false });
    expect(recordRound(1, 1, [], [], "2026-10-31")).toMatchObject({ streak: 2, streakGrew: true });
    expect(recordRound(1, 1, [], [], "2026-11-01")).toMatchObject({ streak: 3, streakGrew: true });
    expect(activeStreak(getStudy(), "2026-11-02")).toBe(3);
    expect(activeStreak(getStudy(), "2026-11-03")).toBe(0);
    expect(recordRound(1, 1, [], [], "2026-11-03")).toMatchObject({ streak: 1, streakGrew: true });
  });
});

describe("topicToNote", () => {
  it("robi notatkę z listą kontrolną punktów tematu i ostrzeżeniami o ryzyku", () => {
    const topic = TOPICS.find((t) => t.id === "trojniki")!;
    const note = topicToNote(topic, 1000, "n1");
    expect(note.title).toBe("Nauka: Trójniki przy krzyżowaniu rur");
    expect(note.labels).toEqual(["nauka"]);
    expect(note.checklist).toHaveLength(CHECKLIST.filter((c) => c.topic === "trojniki").length);
    expect(note.checklist![0].text.startsWith("⚠ ")).toBe(true);
    expect(note.content).toContain("## Na co uważać");
    expect(note.content).toContain("przeciek");
  });
});

describe("dziennik z budowy", () => {
  beforeEach(freshStudy);

  it("klucze zdjęć z dziennika czytane z dokumentu (bez sklepu) — dla odśmiecania, kopii i synchronizacji", () => {
    const a = "a".repeat(64), b = "b".repeat(64);
    addJournalEntry({ kind: "ok", topic: null, text: "Zdjęcia", images: [a, b, "nie-klucz"] }, 1000);
    addJournalEntry({ kind: "note", topic: null, text: "Drugie", images: [a] }, 2000);
    expect([...journalImageRefs()].sort()).toEqual([a, b]);
    expect(yjsStore.referencedImages().has(b)).toBe(true);
    expect(yjsStore.syncableRefs().has(b)).toBe(true);
    // Zepsuty dawny zapis w localStorage nie zdejmuje ochrony ze zdjęć z dokumentu.
    localStorage.setItem("kaczy.study.v1", "{zepsute");
    expect([...journalImageRefs()].sort()).toEqual([a, b]);
  });

  it("dodaje wpis z aktualną inwestycją i zapisuje punkty z listy", () => {
    setSite("Dom Kowalskich, ul. Leśna 4");
    const e = addJournalEntry({ kind: "ok", topic: "trojniki", text: "  Skrzyżowanie przy kuchni  ", checked: ["trojniki-1", "nie-ma"] }, 1000)!;
    expect(e).toMatchObject({ kind: "ok", topic: "trojniki", text: "Skrzyżowanie przy kuchni", site: "Dom Kowalskich, ul. Leśna 4", checked: ["trojniki-1"] });
    expect(getStudy().journal).toHaveLength(1);
  });

  it("odrzuca pusty wpis i nieznany temat zamienia na ogólny", () => {
    expect(addJournalEntry({ kind: "note", topic: null, text: "   " })).toBeNull();
    const e = addJournalEntry({ kind: "note", topic: "obcy-temat", text: "coś" })!;
    expect(e.topic).toBeNull();
  });

  it("problem cofa temat z „Umiem” do „W trakcie”, zwykły wpis nie", () => {
    moveTopic("spadki", "done");
    moveTopic("napowietrzanie", "done");
    addJournalEntry({ kind: "ok", topic: "napowietrzanie", text: "Wywiewka założona" });
    addJournalEntry({ kind: "problem", topic: "spadki", text: "Za mały spadek na odcinku" });
    expect(columnOf(getStudy(), "spadki")).toBe("doing");
    expect(columnOf(getStudy(), "napowietrzanie")).toBe("done");
  });

  it("usuwa i przywraca wpis na swoje miejsce w czasie", () => {
    const a = addJournalEntry({ kind: "note", topic: null, text: "pierwszy" }, 1000)!;
    addJournalEntry({ kind: "note", topic: null, text: "drugi" }, 2000);
    removeJournalEntry(a.id);
    expect(getStudy().journal.map((e) => e.text)).toEqual(["drugi"]);
    restoreJournalEntry(a);
    expect(getStudy().journal.map((e) => e.text)).toEqual(["pierwszy", "drugi"]);
  });

  it("liczy praktykę per temat", () => {
    addJournalEntry({ kind: "ok", topic: "otulina", text: "a" }, 1000);
    addJournalEntry({ kind: "ok", topic: "otulina", text: "b" }, 2000);
    addJournalEntry({ kind: "problem", topic: "otulina", text: "c" }, 3000);
    addJournalEntry({ kind: "note", topic: null, text: "d" }, 4000);
    const p = practiceByTopic(getStudy().journal).get("otulina");
    expect(p).toEqual({ ok: 2, problem: 1, last: 3000 });
  });

  it("sanitizeStudy odfiltrowuje uszkodzone wpisy i przycina tekst", () => {
    const d = { board: {}, checked: {}, bestPercent: null, rounds: 0, missed: {}, journal: [], site: "", sites: {}, streak: 0, lastDay: null };
    const s = sanitizeStudy(d, {
      site: "x".repeat(500),
      journal: [
        { id: "ok1", at: 5, kind: "ok", topic: "spadki", text: "dobrze", site: "S", checked: ["spadki-1", "duch"] },
        { id: "zly-rodzaj", at: 6, kind: "?", topic: null, text: "x", site: "", checked: [] },
        { id: "bez-czasu", at: "wczoraj", kind: "ok", topic: null, text: "x", site: "", checked: [] },
        { id: "pusty", at: 7, kind: "note", topic: null, text: "  ", site: "", checked: [] },
        "śmieć",
      ],
    });
    expect(s.site).toHaveLength(120);
    expect(s.journal).toHaveLength(1);
    expect(s.journal[0]).toMatchObject({ id: "ok1", topic: "spadki", checked: ["spadki-1"] });
  });
});

describe("dziennik — edycja i problemy", () => {
  beforeEach(freshStudy);

  it("wpis „za wczoraj”: podany moment, przyszłość przycięta do teraz", () => {
    const now = 10_000;
    expect(addJournalEntry({ kind: "note", topic: null, text: "wczoraj", at: 4000 }, now)!.at).toBe(4000);
    expect(addJournalEntry({ kind: "note", topic: null, text: "jutro", at: 99_000 }, now)!.at).toBe(now);
    expect(addJournalEntry({ kind: "note", topic: null, text: "teraz", at: null }, now)!.at).toBe(now);
  });

  it("edycja zmienia wpis w miejscu, z własną budową i nowym miejscem w czasie", () => {
    setSite("Budowa A");
    const a = addJournalEntry({ kind: "note", topic: null, text: "pierwszy" }, 1000)!;
    addJournalEntry({ kind: "note", topic: null, text: "drugi" }, 2000);
    setSite("Budowa B");
    const e = updateJournalEntry(a.id, { kind: "ok", topic: "spadki", text: " poprawiony ", checked: ["spadki-1"], at: 3000, site: "Budowa A2", resolved: 5 }, 9000)!;
    expect(e).toMatchObject({ id: a.id, kind: "ok", text: "poprawiony", site: "Budowa A2", at: 3000 });
    expect(e.resolved).toBeUndefined();
    expect(getStudy().journal.map((x) => x.text)).toEqual(["drugi", "poprawiony"]);
    expect(getStudy().site).toBe("Budowa B");
    expect(updateJournalEntry(a.id, { kind: "ok", topic: null, text: "  ", at: 3000, site: "", resolved: null })).toBeNull();
    expect(getStudy().journal).toHaveLength(2);
  });

  it("edycja na problem cofa temat z „Umiem”; poprawka tekstu istniejącego problemu już nie", () => {
    const e = addJournalEntry({ kind: "ok", topic: "spadki", text: "ok" })!;
    moveTopic("spadki", "done");
    updateJournalEntry(e.id, { kind: "problem", topic: "spadki", text: "jednak nie", at: e.at, site: "", resolved: null });
    expect(columnOf(getStudy(), "spadki")).toBe("doing");
    moveTopic("spadki", "done");
    updateJournalEntry(e.id, { kind: "problem", topic: "spadki", text: "jednak nie, poprawka", at: e.at, site: "", resolved: null });
    expect(columnOf(getStudy(), "spadki")).toBe("done");
  });

  it("problem otwarty → rozwiązany → otwarty; licznik otwartych", () => {
    const p1 = addJournalEntry({ kind: "problem", topic: null, text: "przeciek" }, 1000)!;
    addJournalEntry({ kind: "problem", topic: null, text: "spadek" }, 2000);
    const ok = addJournalEntry({ kind: "ok", topic: null, text: "zrobione" }, 3000)!;
    expect(openProblems(getStudy().journal)).toBe(2);
    setProblemResolved(p1.id, true, 5000);
    setProblemResolved(ok.id, true, 5000);
    expect(getStudy().journal.find((e) => e.id === p1.id)!.resolved).toBe(5000);
    expect(getStudy().journal.find((e) => e.id === ok.id)!.resolved).toBeUndefined();
    expect(openProblems(getStudy().journal)).toBe(1);
    setProblemResolved(p1.id, false);
    expect(openProblems(getStudy().journal)).toBe(2);
  });

  it("formularz edycji jest osobno od szkicu, a jego zdjęcia chronione do zamknięcia", () => {
    const img = "a".repeat(64), added = "b".repeat(64);
    patchJournalDraft({ ...EMPTY_DRAFT, text: "szkic nowego" });
    const e = addJournalEntry({ kind: "problem", topic: null, text: "stary", images: [img] }, 1000)!;
    openJournalEdit(e);
    patchJournalEditForm({ text: "zmieniony", images: [img, added] });
    expect(getJournalDraft().text).toBe("szkic nowego");
    expect(getJournalEditForm()).toMatchObject({ id: e.id, at: 1000, resolved: null, text: "zmieniony" });
    expect(journalImageRefs().has(added)).toBe(true);
    closeJournalSheet();
    expect(getJournalEditForm()).toBeNull();
    expect(journalImageRefs().has(added)).toBe(false);
    patchJournalEditForm({ text: "po zamknięciu" });
    expect(getJournalEditForm()).toBeNull();
  });

  it("sanitizeStudy zostawia rozwiązanie tylko problemom", () => {
    const d = { board: {}, checked: {}, bestPercent: null, rounds: 0, missed: {}, journal: [], site: "", sites: {}, streak: 0, lastDay: null };
    const s = sanitizeStudy(d, { journal: [
      { id: "p", at: 1, kind: "problem", topic: null, text: "a", site: "", checked: [], images: [], resolved: 7 },
      { id: "n", at: 2, kind: "note", topic: null, text: "b", site: "", checked: [], images: [], resolved: 7 },
      { id: "q", at: 3, kind: "problem", topic: null, text: "c", site: "", checked: [], images: [], resolved: "wczoraj" },
    ] });
    expect(s.journal.map((e) => e.resolved)).toEqual([7, undefined, undefined]);
  });

  it("data i godzina: pole datetime-local w czasie lokalnym i krótka etykieta", () => {
    const at = new Date(2026, 9, 14, 7, 5).getTime();
    expect(toLocalInput(at)).toBe("2026-10-14T07:05");
    expect(fromLocalInput("2026-10-14T07:05")).toBe(at);
    expect(fromLocalInput("")).toBeNull();
    const now = new Date(2026, 9, 15, 12).getTime();
    expect(whenLabel(new Date(2026, 9, 15, 9, 30).getTime(), now)).toBe("dziś, 09:30");
    expect(whenLabel(at, now)).toBe("wczoraj, 07:05");
    expect(whenLabel(new Date(2025, 9, 1, 8).getTime(), now)).toMatch(/2025/);
  });
});

describe("dziennik — limit i etykiety", () => {
  it("bez limitu wpisów (dawny limit kasował najstarsze po cichu)", () => {
    const journal = Array.from({ length: 3500 }, (_, i) => ({ id: `e${i}`, at: i + 1, kind: "note", topic: null, text: `w${i}`, site: "", checked: [], images: [] }));
    const d = { board: {}, checked: {}, bestPercent: null, rounds: 0, missed: {}, journal: [], site: "", sites: {}, streak: 0, lastDay: null };
    const s = sanitizeStudy(d, { journal });
    expect(s.journal).toHaveLength(3500);
    expect(s.journal[0].text).toBe("w0");
  });

  it("etykieta dnia ma rok tylko dla innego roku niż bieżący", () => {
    const now = new Date(2026, 9, 15, 12).getTime();
    expect(dayLabel(new Date(2026, 9, 14, 8).getTime(), now)).not.toMatch(/2026/);
    expect(dayLabel(new Date(2025, 9, 14, 8).getTime(), now)).toMatch(/2025/);
  });

  it("odmienia liczniki", () => {
    expect([1, 2, 5, 12, 22].map(entriesPl)).toEqual(["1 wpis", "2 wpisy", "5 wpisów", "12 wpisów", "22 wpisy"]);
    expect([0, 1, 3].map(problemsPl)).toEqual(["0 problemów", "1 problem", "3 problemy"]);
  });
});

describe("szkic wpisu", () => {
  beforeEach(() => {
    localStorage.clear();
    patchJournalDraft({ ...EMPTY_DRAFT });
  });

  it("przeżywa zmianę tematu bez utraty tekstu i zdjęć; punkty listy się zerują", () => {
    const img = "c".repeat(64);
    patchJournalDraft({ topic: "spadki", text: "Spadek 2%", checked: ["spadki-1"], images: [img] });
    setJournalDraftTopic("spadki");
    expect(getJournalDraft().checked).toEqual(["spadki-1"]);
    setJournalDraftTopic("otulina");
    expect(getJournalDraft()).toMatchObject({ topic: "otulina", text: "Spadek 2%", checked: [], images: [img] });
  });

  it("po zapisie czyści treść, a rodzaj i temat zostają", () => {
    patchJournalDraft({ topic: "otulina", kind: "problem", text: "x", checked: ["a"], images: ["d".repeat(64)] });
    clearJournalDraft();
    expect(getJournalDraft()).toEqual({ ...EMPTY_DRAFT, topic: "otulina", kind: "problem" });
  });

  it("zdjęcia ze szkicu są chronione przed odśmiecaniem", () => {
    const img = "e".repeat(64);
    patchJournalDraft({ images: [img] });
    expect(journalImageRefs().has(img)).toBe(true);
    localStorage.setItem("kaczy.study.draft.v1", "{zepsute");
    expect(journalImageRefs().has(img)).toBe(false);
  });

  it("sanitizeDraft odrzuca śmieci", () => {
    expect(sanitizeDraft(EMPTY_DRAFT, { kind: "?", text: 5, images: ["nie-klucz", "f".repeat(64)], checked: [1, "a"], at: "wczoraj" }))
      .toEqual({ ...EMPTY_DRAFT, images: ["f".repeat(64)], checked: ["a"] });
    expect(sanitizeDraft(EMPTY_DRAFT, { at: 1234 }).at).toBe(1234);
    expect(sanitizeDraft(EMPTY_DRAFT, null)).toBe(EMPTY_DRAFT);
  });
});

describe("dziennik — oś czasu i filtry", () => {
  const at = (d: number, h: number) => new Date(2026, 9, d, h, 0).getTime();
  const e = (id: string, a: number, kind: "ok" | "problem" | "note", site: string, text = "", extra: Partial<{ topic: string; resolved: number }> = {}) =>
    ({ id, at: a, kind, site, text, topic: extra.topic ?? null, checked: [], images: [], ...(extra.resolved !== undefined ? { resolved: extra.resolved } : {}) });
  const entries = [
    e("a", at(14, 8), "ok", "Lipowa 5", "Próba szczelności"),
    e("b", at(14, 15), "problem", "Polna 2", "Żółta rura przecieka", { topic: "spadki" }),
    e("c", at(14, 10), "note", "Lipowa 5 ", "Zamówić kolana"),
    e("d", at(13, 9), "problem", "", "Brak złączek", { resolved: at(13, 12) }),
  ];

  it("grupuje dzień → budowa, od najnowszego", () => {
    const days = groupJournal(entries, at(15, 12));
    expect(days.map((d) => [d.key, d.count])).toEqual([["2026-10-14", 3], ["2026-10-13", 1]]);
    expect(days[0].sites.map((g) => [g.site, g.entries.map((x) => x.id)])).toEqual([["Polna 2", ["b"]], ["Lipowa 5", ["c", "a"]]]);
    expect(days[1].sites[0].site).toBe("");
  });

  it("filtruje po rodzaju, otwartych problemach, budowie i temacie", () => {
    const ids = (f: Partial<typeof NO_FILTER>) => filterJournal(entries, { ...NO_FILTER, ...f }).map((x) => x.id);
    expect(ids({ kind: "problem" })).toEqual(["b", "d"]);
    expect(ids({ kind: "open" })).toEqual(["b"]);
    expect(ids({ site: siteKey("Lipowa 5") })).toEqual(["a", "c"]);
    expect(ids({ site: "" })).toEqual(["d"]);
    expect(ids({ topic: "spadki" })).toEqual(["b"]);
  });

  it("szuka bez ogonków, po wszystkich słowach, też w nazwie tematu", () => {
    const ids = (query: string) => filterJournal(entries, { ...NO_FILTER, query }, (id) => (id === "spadki" ? "Spadki kanalizacji" : null)).map((x) => x.id);
    expect(ids("zolta")).toEqual(["b"]);
    expect(ids("ZLACZEK")).toEqual(["d"]);
    expect(ids("lipowa proba")).toEqual(["a"]);
    expect(ids("kanalizacji")).toEqual(["b"]);
    expect(ids("polna kolana")).toEqual([]);
  });

  it("budowy od ostatnio używanej i okno 30 dni", () => {
    expect(siteDirectory({}, entries).map((s) => [s.name, s.count, s.open, s.stored])).toEqual([["Polna 2", 1, 1, false], ["Lipowa 5", 2, 0, false]]);
    const old = e("x", new Date(2026, 8, 15, 23, 59).getTime(), "ok", "");
    const edge = e("y", new Date(2026, 8, 16, 0, 0).getTime(), "ok", "");
    const { recent, older } = splitRecent([...entries, old, edge], at(15, 12));
    expect(recent.map((x) => x.id)).toEqual(["a", "b", "c", "d", "y"]);
    expect(older).toBe(1);
  });

  it("podpowiada budowy: bez bieżącej, po wpisanych słowach bez ogonków, z limitem", () => {
    const sites = ["Polna 2", "Łąkowa 7", "Lipowa 5", "Ogrodowa 1"];
    expect(suggestSites(sites, "", "Polna 2")).toEqual(["Łąkowa 7", "Lipowa 5", "Ogrodowa 1"]);
    expect(suggestSites(sites, "lakowa", "")).toEqual(["Łąkowa 7"]);
    expect(suggestSites(sites, "owa", "", 2)).toEqual(["Łąkowa 7", "Lipowa 5"]);
    expect(suggestSites(sites, "Lipowa 5", "Lipowa 5")).toEqual([]);
  });
});

describe("budowy — karty", () => {
  beforeEach(freshStudy);

  it("pierwszy wpis z nową nazwą zakłada kartę; kolejny trafia do niej mimo innej pisowni", () => {
    setSite("Lipowa 5");
    const a = addJournalEntry({ kind: "ok", topic: null, text: "Pion" }, 1000)!;
    expect(a.siteId).toBe(siteKey("Lipowa 5"));
    expect(getStudy().sites[a.siteId!]).toMatchObject({ name: "Lipowa 5", address: "", investor: "", created: 1000 });
    setSite("  lipowa   5 ");
    const b = addJournalEntry({ kind: "ok", topic: null, text: "Poziom" }, 2000)!;
    expect(b).toMatchObject({ siteId: a.siteId, site: "Lipowa 5" });
    expect(Object.keys(getStudy().sites)).toHaveLength(1);
  });

  it("stare wpisy z samą nazwą: budowa liczona z nazwy, karta dopiero przy edycji", () => {
    yStudy.addEntry({ id: "stary", at: 500, kind: "note", topic: null, text: "Sprzed kart", site: "Polna 2", checked: [], images: [] });
    const [e] = getStudy().journal;
    expect(e.siteId).toBe(siteKey("Polna 2"));
    expect(getStudy().sites).toEqual({});
    expect(saveSiteCard(e.siteId!, { name: "Dom Nowaków", address: " ul. Polna 2 ", investor: "Nowak" }, 900)).toBe(true);
    expect(getStudy().sites[e.siteId!]).toMatchObject({ name: "Dom Nowaków", address: "ul. Polna 2", investor: "Nowak", created: 500 });
    // Wpis bez `siteId` w dokumencie dostaje nazwę z karty.
    expect(getStudy().journal[0].site).toBe("Dom Nowaków");
    expect(saveSiteCard(e.siteId!, { name: "  ", address: "", investor: "" })).toBe(false);
  });

  it("zmiana nazwy przenosi bieżącą budowę arkusza; stara nazwa po zmianie zakłada nową kartę", () => {
    setSite("Polna 2");
    const a = addJournalEntry({ kind: "ok", topic: null, text: "Pion" }, 1000)!;
    saveSiteCard(a.siteId!, { name: "Dom Nowaków", address: "", investor: "" });
    expect(getStudy().site).toBe("Dom Nowaków");
    expect(addJournalEntry({ kind: "ok", topic: null, text: "Dalej" }, 2000)!.siteId).toBe(a.siteId);
    setSite("Polna 2");
    const c = addJournalEntry({ kind: "ok", topic: null, text: "Inna" }, 3000)!;
    expect(c.siteId).not.toBe(a.siteId);
    expect(getStudy().sites[a.siteId!].name).toBe("Dom Nowaków");
    expect(getStudy().sites[c.siteId!].name).toBe("Polna 2");
  });

  it("archiwum: budowa zostaje z wpisami, a ta sama nazwa wraca do niej", () => {
    setSite("Lipowa 5");
    const a = addJournalEntry({ kind: "problem", topic: null, text: "Przeciek" }, 1000)!;
    setSiteArchived(a.siteId!, true, 5000);
    const dir = siteDirectory(getStudy().sites, getStudy().journal);
    expect(dir[0]).toMatchObject({ id: a.siteId, archived: 5000, count: 1, open: 1 });
    expect(findSiteByName(dir, "LIPOWA 5")?.id).toBe(a.siteId);
    setSiteArchived(a.siteId!, false);
    expect(getStudy().sites[a.siteId!].archived).toBeUndefined();
  });

  it("edycja wpisu: inna budowa w arkuszu przepina siteId, pusta — bez budowy", () => {
    setSite("Lipowa 5");
    const a = addJournalEntry({ kind: "ok", topic: null, text: "Pion" }, 1000)!;
    const base = { kind: "ok" as const, topic: null, text: "Pion", resolved: null, at: 1000 };
    expect(updateJournalEntry(a.id, { ...base, site: "Polna 2" }, 2000)!.siteId).toBe(siteKey("Polna 2"));
    const none = updateJournalEntry(a.id, { ...base, site: "" }, 2000)!;
    expect(none.siteId).toBeUndefined();
    expect(entrySiteId(none)).toBe("");
  });

  it("resolveSite: id zajęte przez kartę o zmienionej nazwie → losowe", () => {
    const dir = siteDirectory({ [siteKey("Polna 2")]: { id: siteKey("Polna 2"), name: "Dom Nowaków", address: "", investor: "", created: 1 } }, []);
    const r = resolveSite(dir, "Polna 2", 10);
    expect(r.siteId).toMatch(/^s-/);
    expect(r.card).toMatchObject({ name: "Polna 2", created: 10 });
    expect(resolveSite(dir, "dom nowakow", 10)).toEqual({ siteId: siteKey("Polna 2"), site: "Dom Nowaków" });
    expect(resolveSite(dir, "   ", 10)).toEqual({ siteId: undefined, site: "" });
  });
});
