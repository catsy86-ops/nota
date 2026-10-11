import { describe, it, expect, beforeEach } from "vitest";
import { CHECKLIST, QUESTIONS, TOPICS } from "./content";
import { buildRound, missedTopics, scoreRound } from "./quiz";
import { topicToNote } from "./toNote";
import {
  sanitizeStudy, moveTopic, recordRound, toggleChecked, getStudy, columnOf, resetChecklist,
  addJournalEntry, removeJournalEntry, restoreJournalEntry, setSite, practiceByTopic,
} from "./store";

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
  beforeEach(() => { localStorage.clear(); });

  it("sanitizeStudy odrzuca nieznane tematy i złe wartości", () => {
    const d = { board: {}, checked: {}, bestPercent: null, rounds: 0, missed: {}, journal: [], site: "" };
    expect(sanitizeStudy(d, "śmieci")).toEqual(d);
    const s = sanitizeStudy(d, { board: { spadki: "done", obcy: "done", system: "x" }, checked: { "dok-1": true, a: 1 }, bestPercent: 140, rounds: -2, missed: { "q-pion": true, obce: true } });
    expect(s).toEqual({ board: { spadki: "done" }, checked: { "dok-1": true }, bestPercent: null, rounds: 0, missed: { "q-pion": true }, journal: [], site: "" });
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
  beforeEach(() => {
    localStorage.clear();
    // Stan modułu żyje w pamięci między testami — czyścimy dziennik wprost.
    for (const e of getStudy().journal) removeJournalEntry(e.id);
    setSite("");
    for (const t of ["spadki", "napowietrzanie", "otulina"]) moveTopic(t, "todo");
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
    const d = { board: {}, checked: {}, bestPercent: null, rounds: 0, missed: {}, journal: [], site: "" };
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
