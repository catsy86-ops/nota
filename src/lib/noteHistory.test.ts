import { describe, expect, it } from "vitest";
import { createNoteHistory } from "./noteHistory";

const all = () => true;

describe("historia otwieranych notatek", () => {
  it("cofa i idzie naprzód po kolejnych otwarciach", () => {
    const h = createNoteHistory();
    h.push("a"); h.push("b"); h.push("c");
    expect(h.step(-1, all)).toBe("b");
    h.push("b"); // otwarcie wywołane krokiem nie zmienia historii
    expect(h.step(-1, all)).toBe("a");
    expect(h.step(-1, all)).toBeNull();
    expect(h.step(1, all)).toBe("b");
    expect(h.step(1, all)).toBe("c");
    expect(h.step(1, all)).toBeNull();
  });

  it("nowe otwarcie po cofnięciu ucina przyszłość", () => {
    const h = createNoteHistory();
    h.push("a"); h.push("b"); h.push("c");
    h.step(-1, all);
    h.push("b");
    h.push("d");
    expect(h.step(1, all)).toBeNull();
    expect(h.step(-1, all)).toBe("b");
  });

  it("pomija usunięte notatki i nie dubluje tej samej", () => {
    const h = createNoteHistory();
    h.push("a"); h.push("a"); h.push("x"); h.push("b");
    expect(h.step(-1, (id) => id !== "x")).toBe("a");
    expect(h.step(-1, all)).toBeNull();
  });
});
