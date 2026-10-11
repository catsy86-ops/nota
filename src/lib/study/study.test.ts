import { describe, it, expect, beforeEach } from "vitest";
import { CHECKLIST, QUESTIONS, TOPICS } from "./content";
import { buildRound, missedTopics, scoreRound } from "./quiz";
import { topicToNote } from "./toNote";
import { sanitizeStudy, moveTopic, recordRound, toggleChecked, getStudy, columnOf, resetChecklist } from "./store";

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
    const d = { board: {}, checked: {}, bestPercent: null, rounds: 0, missed: {} };
    expect(sanitizeStudy(d, "śmieci")).toEqual(d);
    const s = sanitizeStudy(d, { board: { spadki: "done", obcy: "done", system: "x" }, checked: { "dok-1": true, a: 1 }, bestPercent: 140, rounds: -2, missed: { "q-pion": true, obce: true } });
    expect(s).toEqual({ board: { spadki: "done" }, checked: { "dok-1": true }, bestPercent: null, rounds: 0, missed: { "q-pion": true } });
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
