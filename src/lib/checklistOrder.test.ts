import { describe, expect, it } from "vitest";
import { moveOpenItem } from "./checklistOrder";

const item = (id: string, checked = false) => ({ id, text: id, checked });

describe("przeciąganie pozycji listy", () => {
  it("przenosi w dół i w górę wśród nieodhaczonych", () => {
    const items = [item("a"), item("b"), item("c")];
    expect(moveOpenItem(items, "a", "c").map((i) => i.id)).toEqual(["b", "c", "a"]);
    expect(moveOpenItem(items, "c", "a").map((i) => i.id)).toEqual(["c", "a", "b"]);
  });

  it("odhaczone zostają na swoich miejscach", () => {
    const items = [item("a"), item("x", true), item("b"), item("c")];
    expect(moveOpenItem(items, "c", "a").map((i) => i.id)).toEqual(["c", "x", "a", "b"]);
  });

  it("bez zmiany zwraca tę samą tablicę", () => {
    const items = [item("a"), item("b")];
    expect(moveOpenItem(items, "a", "a")).toBe(items);
    expect(moveOpenItem(items, "a", "nie-ma")).toBe(items);
    const withDone = [item("a"), item("x", true)];
    expect(moveOpenItem(withDone, "a", "x")).toBe(withDone);
  });
});
