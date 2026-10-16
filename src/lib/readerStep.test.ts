import { describe, it, expect } from "vitest";
import { readerNeighbors } from "./readerStep";

describe("readerNeighbors", () => {
  const ids = ["a", "b", "c"];

  it("w środku listy ma obu sąsiadów", () => {
    expect(readerNeighbors(ids, "b")).toEqual({ prev: "a", next: "c" });
  });

  it("na krawędzi brakuje jednego sąsiada", () => {
    expect(readerNeighbors(ids, "a")).toEqual({ prev: null, next: "b" });
    expect(readerNeighbors(ids, "c")).toEqual({ prev: "b", next: null });
  });

  it("notatka spoza listy albo brak bieżącej nie ma sąsiadów", () => {
    expect(readerNeighbors(ids, "x")).toEqual({ prev: null, next: null });
    expect(readerNeighbors(ids, null)).toEqual({ prev: null, next: null });
    expect(readerNeighbors([], "a")).toEqual({ prev: null, next: null });
  });

  it("pojedyncza notatka nie ma sąsiadów", () => {
    expect(readerNeighbors(["a"], "a")).toEqual({ prev: null, next: null });
  });
});
