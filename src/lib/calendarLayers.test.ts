import { describe, it, expect, beforeEach } from "vitest";
import { ALL_LAYERS_ON, countMonth, readLayers, writeLayers } from "./calendarLayers";

describe("warstwy kalendarza (K3.3)", () => {
  beforeEach(() => localStorage.clear());

  it("bez zapisu wszystkie warstwy są włączone", () => {
    expect(readLayers()).toEqual(ALL_LAYERS_ON);
  });

  it("wybór zapamiętuje się i wraca po odczycie", () => {
    writeLayers({ ...ALL_LAYERS_ON, work: false });
    expect(readLayers()).toEqual({ ...ALL_LAYERS_ON, work: false });
  });

  it("zepsuty zapis = wszystko włączone", () => {
    localStorage.setItem("kaczy.calendar.layers", "{nie json");
    expect(readLayers()).toEqual(ALL_LAYERS_ON);
  });

  it("liczniki sumują wystąpienia i dni każdej warstwy", () => {
    const counts = countMonth(
      ["2026-10-01", "2026-10-02", "2026-10-03"],
      (k) => (k === "2026-10-01" ? 2 : 0),
      (k) => k !== "2026-10-03",
      (k) => k === "2026-10-02",
      (k) => k === "2026-10-01",
    );
    expect(counts).toEqual({ terms: 2, shifts: 2, work: 1, holidays: 1 });
  });
});
