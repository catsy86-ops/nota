import { describe, it, expect } from "vitest";
import { cleanCustom, cleanCustomList, questionOptions, isCustomId, CUSTOM_MAX } from "./custom";

const q = (over: Record<string, unknown> = {}) => ({
  kind: "question", id: "c-1", topic: "system", question: "Pytanie?", correct: "A", wrong: ["B", "C", "D"], explanation: "", ...over,
});

describe("cleanCustom", () => {
  it("przepuszcza poprawne pytanie i punkt, przycina tekst", () => {
    expect(cleanCustom(q({ question: "  Ile?  " }))).toMatchObject({ kind: "question", question: "Ile?", explanation: "" });
    expect(cleanCustom({ kind: "item", id: "c-2", topic: "laczenie", text: "  sprawdź tuleję  " })).toEqual({ kind: "item", id: "c-2", topic: "laczenie", text: "sprawdź tuleję" });
  });

  it("odrzuca id bez przedrostka c-, brak tematu i nieznany rodzaj", () => {
    expect(cleanCustom(q({ id: "q-system" }))).toBeNull();
    expect(cleanCustom(q({ topic: "" }))).toBeNull();
    expect(cleanCustom({ kind: "inne", id: "c-3", topic: "system", text: "x" })).toBeNull();
    expect(cleanCustom(null)).toBeNull();
  });

  it("wymaga dokładnie trzech błędnych odpowiedzi i czterech różnych", () => {
    expect(cleanCustom(q({ wrong: ["B", "C"] }))).toBeNull();
    expect(cleanCustom(q({ wrong: ["B", "B", "D"] }))).toBeNull();
    expect(cleanCustom(q({ correct: "B" }))).toBeNull();
    expect(cleanCustom(q({ wrong: ["B", "", "D"] }))).toBeNull();
  });

  it("pilnuje długości tekstów", () => {
    expect(cleanCustom(q({ question: "x".repeat(301) }))).toBeNull();
    expect(cleanCustom(q({ explanation: "x".repeat(501) }))).toMatchObject({ explanation: "x".repeat(500) });
    expect(cleanCustom({ kind: "item", id: "c-4", topic: "system", text: "x".repeat(301) })).toBeNull();
  });

  it("questionOptions daje poprawną odpowiedź na pierwszym miejscu (jak materiał)", () => {
    const e = cleanCustom(q());
    expect(e && e.kind === "question" ? questionOptions(e) : null).toEqual(["A", "B", "C", "D"]);
  });
});

describe("cleanCustomList", () => {
  it("odrzuca śmieci i duplikaty id, przyjmuje mapę i tablicę", () => {
    const item = { kind: "item", id: "c-5", topic: "system", text: "t" };
    expect(cleanCustomList([item, item, "x", null])).toEqual([item]);
    expect(cleanCustomList({ "c-5": item })).toEqual([item]);
    expect(cleanCustomList("nie lista")).toEqual([]);
  });

  it("obcina do limitu", () => {
    const many = Array.from({ length: CUSTOM_MAX + 20 }, (_, i) => ({ kind: "item", id: `c-${i}`, topic: "system", text: "t" }));
    expect(cleanCustomList(many)).toHaveLength(CUSTOM_MAX);
  });
});

describe("isCustomId", () => {
  it("rozpoznaje własne id po przedrostku", () => {
    expect(isCustomId("c-abc")).toBe(true);
    expect(isCustomId("system-1")).toBe(false);
  });
});
