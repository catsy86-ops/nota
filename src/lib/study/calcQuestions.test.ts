import { describe, expect, it } from "vitest";
import { CALC_QUESTIONS } from "./calcQuestions";
import { QUESTIONS, TOPICS } from "./content";

// Pytania z kalkulatorów (Etap 4 § 4.4): poprawna odpowiedź zgodna z kalkulatorem, cztery różne opcje.
describe("CALC_QUESTIONS", () => {
  it("każde pytanie ma cztery różne opcje i istniejący temat", () => {
    for (const q of CALC_QUESTIONS) {
      expect(new Set(q.options).size, q.id).toBe(4);
      expect(TOPICS.some((t) => t.id === q.topic), q.id).toBe(true);
    }
  });

  it("poprawne opcje: próba 9 bar, spadek 20 cm, pojemność 2 l", () => {
    const first = Object.fromEntries(CALC_QUESTIONS.map((q) => [q.id, q.options[0]]));
    expect(first["calc-proba-9"]).toBe("9 bar");
    expect(first["calc-spadek-20"]).toBe("20 cm");
    expect(first["calc-poj-2"]).toBe("2 l");
  });

  it("identyfikatory nie kolidują z pytaniami wbudowanymi", () => {
    const builtin = new Set(QUESTIONS.map((q) => q.id));
    for (const q of CALC_QUESTIONS) expect(builtin.has(q.id), q.id).toBe(false);
  });
});
