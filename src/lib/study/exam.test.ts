import { describe, it, expect } from "vitest";
import { EXAM_KEEP, EXAM_SECONDS, cleanExam, examResult, keepLatestExams, weakTopicsOf, type ExamResult } from "./exam";
import type { RoundQuestion } from "./quiz";

const q = (id: string, topic: string, correct: number): RoundQuestion => ({ id, topic, question: id, options: ["a", "b", "c", "d"], correct, explanation: "" });
const exam = (id: string, at: number): ExamResult => ({ id, at, correct: 10, total: 20, seconds: 900, byTopic: { pion: [10, 20] } });

describe("wynik egzaminu próbnego (P-3)", () => {
  it("nieodpowiedziane pytanie liczy się jako błędne i daje wynik po tematach", () => {
    const questions = [q("1", "pion", 0), q("2", "pion", 1), q("3", "spadki", 2)];
    const out = examResult(questions, [0, null, 0]);
    expect(out).toEqual({ correct: 1, total: 3, byTopic: { pion: [1, 2], spadki: [0, 1] } });
  });

  it("słabe tematy: te z błędami, najgorszy udział pierwszy, bez dobrych", () => {
    expect(weakTopicsOf({ a: [2, 2], b: [1, 4], c: [1, 2], d: [0, 1] })).toEqual(["d", "b", "c"]);
  });

  it("zapis z dokumentu: zły wpis odpada, poprawny zostaje z wartościami", () => {
    expect(cleanExam({ id: "x", at: 1, correct: 3, total: 2, seconds: 10, byTopic: {} })).toBeNull();
    expect(cleanExam("śmieci")).toBeNull();
    expect(cleanExam({ id: "ok", at: 5, correct: 2, total: 3, seconds: 60, byTopic: { t: [2, 3], bad: [5, 2] } })).toEqual({
      id: "ok", at: 5, correct: 2, total: 3, seconds: 60, byTopic: { t: [2, 3] },
    });
    expect(EXAM_SECONDS).toBe(1800);
  });

  it("trzyma najwyżej EXAM_KEEP najnowszych wyników", () => {
    const many = Array.from({ length: EXAM_KEEP + 5 }, (_, i) => exam(`e${i}`, i));
    const kept = keepLatestExams(many);
    expect(kept).toHaveLength(EXAM_KEEP);
    expect(kept[0].at).toBe(5);
  });
});
