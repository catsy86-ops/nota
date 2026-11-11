import { describe, it, expect } from "vitest";
import { calculateLinearDistance, suggestMileage, mileageCost, exportMileageCSV, cleanMileage, monthEntries, mileageTotals, EMPTY_MILEAGE, type MileageEntry } from "./mileage";

describe("mileage", () => {
  it("calculateLinearDistance: oblicza odległość między dwoma punktami", () => {
    const dist = calculateLinearDistance([52.0, 21.0], [52.1, 21.0]);
    expect(dist).toBe(11.1); // 0,1° szerokości geograficznej

  });

  it("calculateLinearDistance: zwraca 0 dla tego samego punktu", () => {
    const dist = calculateLinearDistance([52.0, 21.0], [52.0, 21.0]);
    expect(dist).toBe(0);
  });

  it("suggestMileage: oblicza trasę między trzema budami", () => {
    const coords: Array<[number, number]> = [[52.0, 21.0], [52.1, 21.0], [52.2, 21.0]];
    expect(suggestMileage(coords)).toBe(28.9); // 2 odcinki po 11,1 km × 1,3
  });

  it("suggestMileage: ignoruje undefined koordynaty", () => {
    const coords: Array<[number, number] | undefined> = [[52.0, 21.0], undefined, [52.1, 21.0]];
    expect(suggestMileage(coords)).toBe(14.4); // brakujący punkt pominięty: jeden odcinek 11,1 km × 1,3
  });

  it("suggestMileage: zwraca 0 dla mniej niż dwóch budów", () => {
    expect(suggestMileage([[52.0, 21.0]])).toBe(0);
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
          date: new Date(2026, 10, 1, 12).getTime(),
          siteIds: ["s1", "s2"],
          distance: 50,
          rate: 0.65,
        },
        {
          id: "m2",
          date: new Date(2026, 10, 2, 12).getTime(),
          siteIds: ["s3"],
          distance: 30,
          rate: 0.65,
        },
      ],
    });

    const lines = csv.replace("\uFEFF", "").trim().split("\r\n");
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(lines[0]).toBe("Data;Trasa;Liczba budów;Dystans (km);Stawka (zł/km);Koszt (zł)");
    // Dni liczone lokalnie (południe), więc data w CSV jest dokładnie ta wpisana.
    expect(lines[1]).toBe("2026-11-01;s1 → s2;2;50;0,65;32,50");
    expect(lines[2]).toBe("2026-11-02;s3;1;30;0,65;19,50");
    expect(lines[lines.length - 1]).toBe("Razem;;;80;;52,00");
    expect(exportMileageCSV({ year: 2026, month: 11, entries: [{ id: "x", date: 1_793_000_000_000, siteIds: ["a"], distance: 1, rate: 1 }] }, () => "=HYPERLINK(1)")).toContain("'=HYPERLINK(1)");
  });

  it("calculateLinearDistance: długość geograficzna liczona z cos(szerokości), nie jak szerokość", () => {
    // 0,1° długości na 52°N to ~6,8 km (nie ~11 km)
    const dist = calculateLinearDistance([52.0, 21.0], [52.0, 21.1]);
    expect(dist).toBe(6.8);
  });

  describe("magazyn", () => {
    const e = (id: string, date: number, distance = 10, rate = 0.5): MileageEntry => ({ id, date, siteIds: ["a"], distance, rate });

    it("cleanMileage: śmieci dają pusty magazyn, zepsute wpisy odpadają", () => {
      expect(cleanMileage(null)).toEqual(EMPTY_MILEAGE);
      expect(cleanMileage("x")).toEqual(EMPTY_MILEAGE);
      const out = cleanMileage({
        rate: 0.9,
        entries: [e("ok", 1_700_000_000_000), { id: "", date: 1, siteIds: [], distance: 1, rate: 1 }, e("bad-km", 1_700_000_000_000, -5), e("bad-rate", 1_700_000_000_000, 5, 99), "x", { ...e("nan", NaN) }],
      });
      expect(out.rate).toBe(0.9);
      expect(out.entries.map((x) => x.id)).toEqual(["ok"]);
    });

    it("cleanMileage: zła stawka wraca do domyślnej", () => {
      expect(cleanMileage({ rate: -1, entries: [] }).rate).toBe(0.65);
    });

    it("monthEntries: tylko wybrany miesiąc, od najstarszego", () => {
      const nov5 = new Date(2026, 10, 5, 12).getTime();
      const nov2 = new Date(2026, 10, 2, 12).getTime();
      const oct = new Date(2026, 9, 31, 12).getTime();
      expect(monthEntries([e("b", nov5), e("c", oct), e("a", nov2)], 2026, 11).map((x) => x.id)).toEqual(["a", "b"]);
    });

    it("mileageTotals: suma km i kosztu", () => {
      expect(mileageTotals([e("a", 1, 50, 0.65), e("b", 2, 30, 0.65)])).toEqual({ km: 80, cost: 52 });
      expect(mileageTotals([])).toEqual({ km: 0, cost: 0 });
    });
  });
});
