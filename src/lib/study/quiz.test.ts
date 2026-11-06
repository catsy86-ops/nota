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
