import { describe, expect, it } from "vitest";
import { mergeSeen, seenOffline } from "./syncSeen";

describe("ostatnio widziane urządzenia", () => {
  it("zapisuje czas po nazwie i nadpisuje nowszym", () => {
    const a = mergeSeen({}, ["Telefon", "Laptop"], 100);
    expect(mergeSeen(a, ["Telefon"], 200)).toEqual({ Telefon: 200, Laptop: 100 });
  });

  it("bez nazw zwraca ten sam obiekt", () => {
    const a = { Telefon: 1 };
    expect(mergeSeen(a, [], 5)).toBe(a);
  });

  it("trzyma najwyżej 20 najświeższych", () => {
    let m = {};
    for (let i = 0; i < 25; i++) m = mergeSeen(m, [`u${i}`], i);
    expect(Object.keys(m)).toHaveLength(20);
    expect(m).not.toHaveProperty("u0");
    expect(m).toHaveProperty("u24");
  });

  it("offline: bez połączonych teraz, najnowsze pierwsze", () => {
    expect(seenOffline({ A: 1, B: 3, C: 2 }, ["B"])).toEqual([{ name: "C", at: 2 }, { name: "A", at: 1 }]);
  });
});
