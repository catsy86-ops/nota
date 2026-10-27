import { describe, it, expect } from "vitest";
import { carryPieces, clockOf, hourBackground, minutesOfDay, shiftPieces, timelineHours } from "./dayTimeline";
import type { ShiftType } from "@/lib/shifts";

const shift = (over: Partial<ShiftType>): ShiftType =>
  ({ id: "d", name: "Dzienna", short: "D", color: "#f59e0b", start: "07:00", end: "15:00", breakMin: 0, ...over }) as ShiftType;

describe("shiftPieces — odcinki zmiany na osi", () => {
  it("zmiana bez przerwy to jeden odcinek pracy", () => {
    expect(shiftPieces(shift({}))).toEqual([{ from: 420, to: 900, work: true }]);
  });

  it("przerwa z godziną rozcina zmianę na pracę, przerwę i pracę", () => {
    expect(shiftPieces(shift({ breakMin: 30, breakAt: "11:00" }))).toEqual([
      { from: 420, to: 660, work: true },
      { from: 660, to: 690, work: false },
      { from: 690, to: 900, work: true },
    ]);
  });

  it("przerwa bez godziny nie rozcina zmiany", () => {
    expect(shiftPieces(shift({ breakMin: 30 }))).toEqual([{ from: 420, to: 900, work: true }]);
  });

  it("urlop nie ma godzin, więc nie ma odcinków", () => {
    expect(shiftPieces(shift({ kind: "absence", start: "00:00", end: "00:00" }))).toEqual([]);
    expect(shiftPieces(undefined)).toEqual([]);
  });

  it("zmiana przez północ kończy się o 24:00+ (odcinek wykracza poza dobę)", () => {
    expect(shiftPieces(shift({ start: "22:00", end: "06:00" }))).toEqual([{ from: 1320, to: 1800, work: true }]);
  });
});

describe("timelineHours — zakres osi", () => {
  it("bez zmiany i terminów: domyślnie 7–21", () => {
    expect(timelineHours([], [])).toEqual({ from: 7, to: 21 });
  });

  it("zmiana wcześniejsza i późniejsza rozszerza oś", () => {
    expect(timelineHours([{ from: 360, to: 1350, work: true }], [])).toEqual({ from: 6, to: 23 });
  });

  it("termin poza zakresem rozszerza oś i obejmuje swoją godzinę", () => {
    expect(timelineHours([], [310])).toEqual({ from: 5, to: 21 });
    expect(timelineHours([], [22 * 60])).toEqual({ from: 7, to: 23 });
  });

  it("nie wychodzi poza dobę", () => {
    expect(timelineHours([{ from: 0, to: 1800, work: true }], [1439])).toEqual({ from: 0, to: 24 });
  });
});

describe("hourBackground — pasek zmiany w godzinie", () => {
  const work = [{ from: 420, to: 900, work: true }];

  it("pełna godzina w zmianie: pasek przez cały wiersz", () => {
    expect(hourBackground(work, 8, "#f59e0b")).toBe(
      "linear-gradient(to bottom, transparent 0%, #f59e0b 0%, #f59e0b 100%, transparent 100%)",
    );
  });

  it("zmiana zaczyna się w połowie godziny: pasek od 50%", () => {
    const pieces = [{ from: 450, to: 900, work: true }];
    expect(hourBackground(pieces, 7, "#f59e0b")).toContain("#f59e0b 50%, #f59e0b 100%");
  });

  it("godzina poza zmianą nie ma tła", () => {
    expect(hourBackground(work, 16, "#f59e0b")).toBeUndefined();
    expect(hourBackground([], 8, "#f59e0b")).toBeUndefined();
  });

  it("przerwa dostaje jaśniejszy kolor", () => {
    const pieces = shiftPieces(shift({ breakMin: 30, breakAt: "11:00" }));
    expect(hourBackground(pieces, 11, "#f59e0b")).toContain("color-mix(in srgb, #f59e0b 30%, transparent) 0%");
  });
});

describe("minutesOfDay", () => {
  it("minuty od północy czasu lokalnego", () => {
    expect(minutesOfDay(new Date(2026, 9, 20, 14, 30).getTime())).toBe(870);
  });
});

describe("nocka przez północ na obu dniach (K2.7)", () => {
  it("część po północy wchodzi w następny dzień od 0:00", () => {
    const night = shift({ id: "n", start: "22:00", end: "06:00" });
    expect(shiftPieces(night)).toEqual([{ from: 1320, to: 1800, work: true }]);
    expect(carryPieces(night)).toEqual([{ from: 0, to: 360, work: true }]);
  });

  it("zmiana w ciągu dnia nie wchodzi w następny dzień", () => {
    expect(carryPieces(shift({}))).toEqual([]);
  });

  it("przerwa po północy zachowuje się jako przerwa w dniu następnym", () => {
    const night = shift({ id: "n", start: "22:00", end: "06:00", breakMin: 30, breakAt: "01:00" });
    expect(carryPieces(night)).toContainEqual({ from: 60, to: 90, work: false });
  });

  it("oś następnego dnia zaczyna się od 0:00, gdy nocka tam wchodzi", () => {
    const pieces = carryPieces(shift({ id: "n", start: "22:00", end: "06:00" }));
    expect(timelineHours(pieces, []).from).toBe(0);
  });

  it("godziny HH:MM także po północy", () => {
    expect(clockOf(60)).toBe("01:00");
    expect(clockOf(1500)).toBe("01:00");
    expect(clockOf(1320)).toBe("22:00");
  });
});
