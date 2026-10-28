import { describe, expect, it } from "vitest";
import { parseQuestionsMd } from "./questionsMd";

const ok = `P: Ile milimetrów ma rura DN16?
A: 16
N: 12
N: 20
N: 25
X: Średnica nominalna.

P: Co łączy kształtka?
A: Rury
N: Ściany
N: Dachy
N: Okna
`;

describe("parseQuestionsMd", () => {
  it("czyta pytania z odpowiedziami i opcjonalnym wyjaśnieniem", () => {
    const r = parseQuestionsMd(ok);
    expect(r.errors).toEqual([]);
    expect(r.questions).toHaveLength(2);
    expect(r.questions[0]).toEqual({ question: "Ile milimetrów ma rura DN16?", correct: "16", wrong: ["12", "20", "25"], explanation: "Średnica nominalna.", line: 1 });
    expect(r.questions[1].explanation).toBe("");
    expect(r.questions[1].line).toBe(8);
  });

  it("akceptuje CRLF i spacje wokół znaczników", () => {
    const r = parseQuestionsMd("  P:  Ile?  \r\n A:  1 \r\n N: 2\r\nN: 3\r\nN: 4\r\n");
    expect(r.errors).toEqual([]);
    expect(r.questions[0]).toMatchObject({ question: "Ile?", correct: "1", wrong: ["2", "3", "4"] });
  });

  it("zgłasza pytanie bez poprawnej odpowiedzi i z dwiema błędnymi, z numerem wiersza", () => {
    const r = parseQuestionsMd("P: Brak A\nN: 1\nN: 2\nN: 3\n\nP: Dwie błędne\nA: x\nN: 1\nN: 2\n");
    expect(r.questions).toEqual([]);
    expect(r.errors).toEqual([
      { line: 1, message: expect.stringContaining("brak poprawnej odpowiedzi") },
      { line: 6, message: expect.stringContaining("3 odpowiedzi błędnych") },
    ]);
  });

  it("odrzuca duplikaty odpowiedzi i wiersze bez znacznika", () => {
    const r = parseQuestionsMd("P: Dup\nA: 1\nN: 1\nN: 2\nN: 3\nco to jest\n");
    expect(r.questions).toEqual([]);
    expect(r.errors.map((e) => e.line)).toEqual([1, 6]);
    expect(r.errors[0].message).toContain("różne");
  });

  it("wiersz przed pierwszym P: to błąd, nie cichy pomijany tekst", () => {
    const r = parseQuestionsMd("wstęp do pliku\nP: Ile?\nA: 1\nN: 2\nN: 3\nN: 4\n");
    expect(r.errors).toEqual([{ line: 1, message: expect.stringContaining("przed pierwszym P") }]);
    expect(r.questions).toHaveLength(1);
  });
});
