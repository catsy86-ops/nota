import { describe, it, expect, beforeEach } from "vitest";
import { CHECKLIST, QUESTIONS, TOPICS } from "./content";
import { buildRound, missedTopics, scoreRound } from "./quiz";
import { topicToNote } from "./toNote";
import { journalImageRefs } from "./images";
import { clearJournalDraft, getJournalDraft, patchJournalDraft, sanitizeDraft, setJournalDraftTopic, EMPTY_DRAFT } from "./draft";
import { dayLabel, entriesPl, problemsPl } from "./journalView";
import {
  sanitizeStudy, moveTopic, recordRound, activeStreak, toggleChecked, getStudy, columnOf, resetChecklist,
  addJournalEntry, removeJournalEntry, restoreJournalEntry, setSite, practiceByTopic,
} from "./store";
import { resetStudyForTests } from "./data";
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
    const d = { board: {}, checked: {}, bestPercent: null, rounds: 0, missed: {}, journal: [], site: "", streak: 0, lastDay: null };
    expect(sanitizeStudy(d, "śmieci")).toEqual(d);
    const s = sanitizeStudy(d, { board: { spadki: "done", obcy: "done", system: "x" }, checked: { "dok-1": true, a: 1 }, bestPercent: 140, rounds: -2, missed: { "q-pion": true, obce: true } });
    expect(s).toEqual({ board: { spadki: "done" }, checked: { "dok-1": true }, bestPercent: null, rounds: 0, missed: { "q-pion": true }, journal: [], site: "", streak: 0, lastDay: null });
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
    const d = { board: {}, checked: {}, bestPercent: null, rounds: 0, missed: {}, journal: [], site: "", streak: 0, lastDay: null };
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

describe("dziennik — limit i etykiety", () => {
  it("bez limitu wpisów (dawny limit kasował najstarsze po cichu)", () => {
    const journal = Array.from({ length: 3500 }, (_, i) => ({ id: `e${i}`, at: i + 1, kind: "note", topic: null, text: `w${i}`, site: "", checked: [], images: [] }));
    const d = { board: {}, checked: {}, bestPercent: null, rounds: 0, missed: {}, journal: [], site: "", streak: 0, lastDay: null };
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
    expect(sanitizeDraft(EMPTY_DRAFT, { kind: "?", text: 5, images: ["nie-klucz", "f".repeat(64)], checked: [1, "a"] }))
      .toEqual({ ...EMPTY_DRAFT, images: ["f".repeat(64)], checked: ["a"] });
    expect(sanitizeDraft(EMPTY_DRAFT, null)).toBe(EMPTY_DRAFT);
  });
});
