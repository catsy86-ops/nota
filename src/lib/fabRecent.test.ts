import { describe, it, expect, beforeEach } from "vitest";
import { orderByRecent, readLastQuick, writeLastQuick } from "./fabRecent";

const items = [{ kind: "note" as const }, { kind: "reminder" as const }, { kind: "list" as const }];

describe("orderByRecent", () => {
  it("bez zapamiętanego rodzaju zostaje domyślna kolejność", () => {
    expect(orderByRecent(items, null)).toEqual(items);
  });

  it("ostatnio użyty rodzaj idzie na górę, reszta zachowuje kolejność", () => {
    expect(orderByRecent(items, "list").map((i) => i.kind)).toEqual(["list", "note", "reminder"]);
  });

  it("rodzaj, którego już nie ma w arkuszu (np. Dyktuj bez rozpoznawania mowy), nie zmienia kolejności", () => {
    expect(orderByRecent(items, "dictate")).toEqual(items);
  });
});

describe("readLastQuick / writeLastQuick", () => {
  beforeEach(() => localStorage.clear());

  it("zapamiętuje rodzaj i odczytuje go z powrotem", () => {
    writeLastQuick("reminder");
    expect(readLastQuick()).toBe("reminder");
  });

  it("nieznana wartość w pamięci jest ignorowana", () => {
    localStorage.setItem("kaczy.fab.last.v1", "cokolwiek");
    expect(readLastQuick()).toBeNull();
  });
});
