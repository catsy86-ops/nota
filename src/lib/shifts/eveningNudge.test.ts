import { describe, expect, it } from "vitest";
import { eveningNudgeFor, shiftLabel } from "./eveningNudge";
import type { DayEntry, ShiftType } from "./model";

const dniowka: ShiftType = { id: "e", name: "Dniówka", short: "D", color: "#f90", start: "08:00", end: "16:00", breakMin: 0 };
const urlop: ShiftType = { id: "u", name: "Urlop", short: "U", color: "#09f", start: "00:00", end: "00:00", breakMin: 0, kind: "absence" };
const types = new Map([[dniowka.id, dniowka], [urlop.id, urlop]]);
const at = (h: number, m = 0) => new Date(2026, 9, 7, h, m);
const days: Record<string, DayEntry> = { "2026-10-08": { type: "e" } };

describe("eveningNudgeFor", () => {
  it("przypomina o jutrzejszej zmianie po ustawionej godzinie", () => {
    const n = eveningNudgeFor(at(20), "20:00", null, days, types);
    expect(n?.title).toBe("Jutro: Dniówka 08:00–16:00");
    expect(n?.forKey).toBe("2026-10-08");
  });

  it("nie przypomina przed godziną ani po wyłączeniu", () => {
    expect(eveningNudgeFor(at(19, 59), "20:00", null, days, types)).toBeNull();
    expect(eveningNudgeFor(at(21), null, null, days, types)).toBeNull();
  });

  it("przypomina raz na jutrzejszy dzień", () => {
    expect(eveningNudgeFor(at(21), "20:00", "2026-10-08", days, types)).toBeNull();
  });

  it("jutro bez zmiany — cisza", () => {
    expect(eveningNudgeFor(at(21), "20:00", null, {}, types)).toBeNull();
  });

  it("nieobecność to sama nazwa, godziny dnia wygrywają z rodzajem", () => {
    expect(eveningNudgeFor(at(21), "20:00", null, { "2026-10-08": { type: "u" } }, types)?.title).toBe("Jutro: Urlop");
    const own = { "2026-10-08": { type: "e", hours: { start: "10:00", end: "18:00", breakMin: 0 } } };
    expect(eveningNudgeFor(at(21), "20:00", null, own, types)?.title).toBe("Jutro: Dniówka 10:00–18:00");
  });

  it("przechodzi przez granicę miesiąca", () => {
    const eom = new Date(2026, 9, 31, 21);
    expect(eveningNudgeFor(eom, "20:00", null, { "2026-11-01": { type: "e" } }, types)?.forKey).toBe("2026-11-01");
  });
});

describe("shiftLabel", () => {
  it("pokazuje godziny tylko dla pracy", () => {
    expect(shiftLabel(dniowka)).toBe("Dniówka 08:00–16:00");
    expect(shiftLabel(urlop)).toBe("Urlop");
  });
});
