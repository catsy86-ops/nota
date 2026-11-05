import { describe, expect, it } from "vitest";
import { cleanDeviceName, mergeSeen, seenOffline } from "./syncSeen";

describe("ostatnio widziane urządzenia", () => {
  it("zapisuje czas po nazwie i nadpisuje nowszym (po minucie)", () => {
    const a = mergeSeen({}, ["Telefon", "Laptop"], 100);
    expect(mergeSeen(a, ["Telefon"], 100 + 61_000)).toEqual({ Telefon: 61_100, Laptop: 100 });
  });

  it("te same urządzenia w ciągu minuty nie zapisują się ponownie", () => {
    const a = mergeSeen({}, ["Telefon"], 1000);
    expect(mergeSeen(a, ["Telefon"], 30_000)).toBe(a);
    expect(mergeSeen(a, ["Nowy"], 30_000)).not.toBe(a);
  });

  it("nazwy bez znaków sterujących i odwracania kierunku; __proto__ nie psuje prototypu", () => {
    expect(cleanDeviceName("Tele\u202Efon\u0007")).toBe("Telefon");
    const m = mergeSeen({}, ["__proto__", "constructor"], 5);
    expect(Object.getPrototypeOf(m)).toBe(Object.prototype);
    expect(m.constructor).toBe(5);
  });

  it("bez nazw zwraca ten sam obiekt", () => {
    const a = { Telefon: 1 };
    expect(mergeSeen(a, [], 5)).toBe(a);
  });

  it("trzyma najwyżej 20 najświeższych", () => {
    let m = {};
    for (let i = 0; i < 25; i++) m = mergeSeen(m, [`u${i}`], i * 100_000);
    expect(Object.keys(m)).toHaveLength(20);
    expect(m).not.toHaveProperty("u0");
    expect(m).toHaveProperty("u24");
  });

  it("offline: bez połączonych teraz, najnowsze pierwsze", () => {
    expect(seenOffline({ A: 1, B: 3, C: 2 }, ["B"])).toEqual([{ name: "C", at: 2 }, { name: "A", at: 1 }]);
  });
});
