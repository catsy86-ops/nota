import { describe, expect, it } from "vitest";
import { examRound } from "./quiz";

describe("egzamin dociągany z listy kontrolnej (P4.3)", () => {
  const q = (id: string) => ({ id, topic: "t", question: id, options: ["ok", "b", "c", "d"] as [string, string, string, string], explanation: "" });
  const item = (id: string, wrong?: [string, string, string]) => ({ id, topic: "lista", text: `punkt ${id}`, wrong });
  const rng = () => 0.5;

  it("dociąga tylko punkty z trzema błędnymi zdaniami, poprawna odpowiedź ma właściwy indeks", () => {
    const round = examRound(3, [q("a")], [item("x", ["e1", "e2", "e3"]), item("y")], rng);
    expect(round).toHaveLength(2);
    const fill = round.find((r) => r.id === "chk-x")!;
    expect(fill.options[fill.correct]).toBe("punkt x");
    expect(round.some((r) => r.id === "chk-y")).toBe(false);
  });

  it("bez punktów z błędnymi zdaniami egzamin zostaje krótszy", () => {
    const round = examRound(5, [q("a"), q("b")], [item("y")], rng);
    expect(round).toHaveLength(2);
  });
});

describe("wbudowana lista kontrolna (P4.3)", () => {
  it("każdy punkt z trzema błędnymi zdaniami daje pytanie z poprawną odpowiedzią pod właściwym indeksem", async () => {
    const { CHECKLIST } = await import("./content");
    const withWrong = CHECKLIST.filter((i) => i.wrong?.length === 3);
    expect(withWrong.length).toBe(14);
    const round = examRound(20, [], CHECKLIST, () => 0.37);
    expect(round).toHaveLength(14);
    for (const q of round) {
      expect(new Set(q.options).size).toBe(4);
      const source = withWrong.find((i) => `chk-${i.id}` === q.id)!;
      expect(q.options[q.correct]).toBe(source.text);
    }
  });
});
