import { describe, it, expect } from "vitest";
import { calculateLinearDistance, suggestMileage, mileageCost, exportMileageCSV } from "./mileage";

describe("mileage", () => {
  it("calculateLinearDistance: oblicza odległość między dwoma punktami", () => {
    const dist = calculateLinearDistance([52.0, 21.0], [52.1, 21.0]);
    expect(dist).toBeGreaterThan(10); // ~11 km
    expect(dist).toBeLessThan(15);
  });

  it("calculateLinearDistance: zwraca 0 dla tego samego punktu", () => {
    const dist = calculateLinearDistance([52.0, 21.0], [52.0, 21.0]);
    expect(dist).toBe(0);
  });

  it("suggestMileage: oblicza trasę między trzema budami", () => {
    const coords = [[52.0, 21.0] as const, [52.1, 21.0] as const, [52.2, 21.0] as const];
    const suggested = suggestMileage(coords);
    expect(suggested).toBeGreaterThan(20); // 2 odcinki × 1,3
  });

  it("suggestMileage: ignoruje undefined koordynaty", () => {
    const coords = [[52.0, 21.0] as const, undefined, [52.1, 21.0] as const];
    const suggested = suggestMileage(coords as any);
    expect(suggested).toBeGreaterThan(10);
  });

  it("suggestMileage: zwraca 0 dla mniej niż dwóch budów", () => {
    expect(suggestMileage([[52.0, 21.0] as const])).toBe(0);
    expect(suggestMileage([])).toBe(0);
  });

  it("mileageCost: oblicza koszt dla domyślnej stawki", () => {
    const cost = mileageCost(100);
    expect(cost).toBe(65); // 100 × 0.65
  });

  it("mileageCost: oblicza koszt dla własnej stawki", () => {
    const cost = mileageCost(100, 1.5);
    expect(cost).toBe(150);
  });

  it("mileageCost: zaokrągla do 2 miejsc po przecinku", () => {
    const cost = mileageCost(33, 0.65);
    expect(cost).toBe(21.45);
  });

  it("exportMileageCSV: zwraca CSV z nagłówkiem i danymi", () => {
    const csv = exportMileageCSV({
      year: 2026,
      month: 11,
      entries: [
        {
          id: "m1",
          date: new Date("2026-11-01").getTime(),
          siteIds: ["s1", "s2"],
          distance: 50,
          rate: 0.65,
        },
        {
          id: "m2",
          date: new Date("2026-11-02").getTime(),
          siteIds: ["s3"],
          distance: 30,
          rate: 0.65,
        },
      ],
      payments: [],
    });

    expect(csv).toContain("Data,Liczba budów,Dystans (km)");
    expect(csv).toContain("2026-11-01,2,50,0.65,32.50");
    expect(csv).toContain("2026-11-02,1,30,0.65,19.50");
    expect(csv.split("\n").pop()).toMatch(/^Razem,,[\d.]+,,52\.00$/);
  });
});
