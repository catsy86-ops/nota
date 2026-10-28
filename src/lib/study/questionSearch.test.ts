import { describe, expect, it } from "vitest";
import { searchQuestions } from "./questionSearch";
import type { Question } from "./content";

const q = (id: string, question: string, explanation = "", options: [string, string, string, string] = ["a", "b", "c", "d"]): Question =>
  ({ id, topic: "proby", question, options, explanation });

const QS = [
  q("1", "Jakie ciśnienie próby szczelności dla PEX?", "Zwykle 1,5× roboczego."),
  q("2", "Spadek kanalizacji poziomej?", "Min. 2% — szczelność złączy też ważna."),
  q("3", "Rodzaj kształtek do rur PEX?", "", ["Złączki zaprasowywane", "b", "c", "d"]),
];

describe("szukanie pytań (P4.2)", () => {
  it("bez polskich znaków znajduje słowa z ogonkami", () => {
    expect(searchQuestions(QS, "szczelnosc").map((x) => x.id)).toEqual(["1", "2"]);
    expect(searchQuestions(QS, "zlaczki").map((x) => x.id)).toEqual(["3"]);
  });

  it("wszystkie słowa muszą pasować; trafienie w treści pytania pierwsze", () => {
    expect(searchQuestions(QS, "cisnienie pex").map((x) => x.id)).toEqual(["1"]);
    expect(searchQuestions(QS, "szczelnosci").map((x) => x.id)).toEqual(["1"]);
  });

  it("puste lub jednoliterowe zapytanie nic nie zwraca; limit działa", () => {
    expect(searchQuestions(QS, " a ")).toEqual([]);
    expect(searchQuestions(QS, "pex", 1)).toHaveLength(1);
  });
});
