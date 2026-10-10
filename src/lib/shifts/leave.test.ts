import { describe, it, expect } from "vitest";
import { DEFAULT_SHIFT_TYPES, EMPTY_SHIFT_DATA, absenceKindOf, leaveBalance, migrate, yearSummary, type DayEntry, type ShiftData } from "./index";

const data = (days: Record<string, DayEntry>, patch: Partial<ShiftData> = {}): ShiftData => ({ ...EMPTY_SHIFT_DATA, days, ...patch });
const U: DayEntry = { type: "u" };
// Środa 2026-10-07, południe.
const TODAY = new Date(2026, 9, 7, 12, 0);

describe("rodzaj nieobecności", () => {
  it("wykrywa po nazwie dla danych sprzed wprowadzenia pola", () => {
    expect(absenceKindOf({ kind: "absence", name: "Urlop" })).toBe("leave");
    expect(absenceKindOf({ kind: "absence", name: "urlop na żądanie" })).toBe("leave");
    expect(absenceKindOf({ kind: "absence", name: "L4" })).toBe("sick");
    expect(absenceKindOf({ kind: "absence", name: "Chorobowe" })).toBe("sick");
    expect(absenceKindOf({ kind: "absence", name: "Urlop bezpłatny" })).toBe("other");
    expect(absenceKindOf({ kind: "absence", name: "Szkolenie" })).toBe("other");
    expect(absenceKindOf({ kind: "work", name: "Urlop" })).toBeUndefined();
  });

  it("jawne pole wygrywa z nazwą", () => {
    expect(absenceKindOf({ kind: "absence", name: "Urlop", absenceKind: "other" })).toBe("other");
    expect(absenceKindOf({ kind: "absence", name: "Wolne", absenceKind: "leave" })).toBe("leave");
  });

  it("migrate dopełnia pole w starych danych i nie psuje pracy", () => {
    const m = migrate({ types: [
      { id: "u", name: "Urlop", start: "08:00", end: "16:00", kind: "absence" },
      { id: "x", name: "Coś", start: "08:00", end: "16:00", kind: "absence", absenceKind: "leave" },
      { id: "d", name: "Dzień", start: "06:00", end: "14:00", absenceKind: "leave" },
      { id: "z", name: "Zły", start: "08:00", end: "16:00", kind: "absence", absenceKind: "wakacje" },
    ] });
    expect(m.types.map((t) => t.absenceKind)).toEqual(["leave", "leave", undefined, "other"]);
  });
});

describe("leaveDays w migrate", () => {
  it("domyślnie 20, przyjmuje poprawną całkowitą, resztę odrzuca", () => {
    expect(migrate({}).leaveDays).toBe(20);
    expect(migrate({ leaveDays: 26 }).leaveDays).toBe(26);
    expect(migrate({ leaveDays: 0 }).leaveDays).toBe(0);
    for (const bad of [20.5, -1, 100, "26", NaN, null]) expect(migrate({ leaveDays: bad }).leaveDays).toBe(20);
  });
});

describe("licznik urlopu", () => {
  it("rozdziela dni do dziś włącznie od zaplanowanych", () => {
    const b = leaveBalance(data({ "2026-10-05": U, "2026-10-06": U, "2026-10-07": U, "2026-10-08": U, "2026-10-09": U }), 2026, TODAY);
    expect(b).toMatchObject({ allowance: 20, used: 3, planned: 2, remaining: 15, offNormDays: 0 });
  });

  it("nie liczy weekendów i świąt do puli, ale je zgłasza", () => {
    // sobota 10.10, niedziela 11.10, środa 11.11 (święto), poniedziałek 12.10
    const b = leaveBalance(data({ "2026-10-10": U, "2026-10-11": U, "2026-11-11": U, "2026-10-12": U }), 2026, TODAY);
    expect(b).toMatchObject({ used: 0, planned: 1, remaining: 19, offNormDays: 3 });
  });

  it("liczy tylko urlop — L4, inne nieobecności i praca nie ubywają z puli", () => {
    const types = [...DEFAULT_SHIFT_TYPES, { id: "ub", name: "Urlop bezpłatny", short: "UB", color: "#000", start: "08:00", end: "16:00", breakMin: 0, kind: "absence" as const }];
    const b = leaveBalance(data({ "2026-10-05": { type: "l4" }, "2026-10-06": { type: "d" }, "2026-10-07": { type: "ub" }, "2026-10-08": U }, { types }), 2026, TODAY);
    expect(b).toMatchObject({ used: 0, planned: 1 });
  });

  it("przełom roku: dzień należy do roku z klucza, 1 stycznia to święto", () => {
    const days = { "2025-12-31": U, "2026-01-01": U, "2026-01-02": U, "2026-12-31": U, "2027-01-04": U };
    expect(leaveBalance(data(days), 2026, TODAY)).toMatchObject({ used: 1, planned: 1, offNormDays: 1 });
    expect(leaveBalance(data(days), 2025, TODAY)).toMatchObject({ used: 1, planned: 0 });
    // Rok przyszły: wszystko przed „dziś” z innego roku nie istnieje, więc zaplanowane.
    expect(leaveBalance(data(days), 2027, TODAY)).toMatchObject({ used: 0, planned: 1 });
  });

  it("dni bez wpisu, z nieznanym rodzajem i z uszkodzonym kluczem są pomijane", () => {
    const b = leaveBalance(data({ "2026-10-05": { type: "nie-ma" }, "2026-10-06": U }), 2026, TODAY);
    expect(b).toMatchObject({ used: 1, planned: 0 });
    expect(leaveBalance(data({}), 2026, TODAY)).toMatchObject({ used: 0, planned: 0, remaining: 20 });
  });

  it("zmiana wymiaru przelicza pozostałe, także poniżej zera", () => {
    const days = { "2026-10-05": U, "2026-10-06": U, "2026-10-08": U };
    expect(leaveBalance(data(days, { leaveDays: 26 }), 2026, TODAY).remaining).toBe(23);
    expect(leaveBalance(data(days, { leaveDays: 2 }), 2026, TODAY).remaining).toBe(-1);
  });

  it("urlop liczony po jawnym rodzaju także po zmianie nazwy", () => {
    const types = DEFAULT_SHIFT_TYPES.map((t) => (t.id === "u" ? { ...t, name: "Wolne", absenceKind: "leave" as const } : t));
    expect(leaveBalance(data({ "2026-10-05": U }, { types }), 2026, TODAY).used).toBe(1);
  });
});

describe("podsumowanie roku", () => {
  it("sumuje miesiące: godziny, urlop, L4 (także w weekend)", () => {
    const y = yearSummary(data({
      "2026-01-05": { type: "d" }, "2026-01-06": { type: "d" },
      "2026-03-10": U, "2026-03-11": U,
      "2026-03-14": { type: "l4" }, "2026-03-16": { type: "l4" },
      "2026-10-10": U, // sobota — poza pulą
      "2025-12-30": { type: "d" }, "2027-01-04": { type: "d" },
    }), 2026);
    expect(y.months).toHaveLength(12);
    expect(y.months[0].minutes).toBe(960);
    expect(y.months[2]).toMatchObject({ leaveDays: 2, sickDays: 2 });
    expect(y.months[9].leaveDays).toBe(0);
    expect(y.total).toMatchObject({ minutes: 960, leaveDays: 2, sickDays: 2, earnings: 0 });
    expect(y.total.leaveDays).toBe(leaveBalance(data({ "2026-03-10": U, "2026-03-11": U }), 2026, TODAY).used);
  });

  it("liczy zarobek, gdy jest stawka, i sumuje nadgodziny", () => {
    const d = data({ "2026-01-05": { type: "d" }, "2026-02-02": { type: "d", extraMin: 240 } }, { hourlyRate: 30 });
    const y = yearSummary(d, 2026);
    expect(y.months[0].earnings).toBe(240);
    expect(y.total.earnings).toBe(y.months.reduce((s, m) => s + m.earnings, 0));
    expect(y.total.earnings).toBeGreaterThan(240);
    expect(y.total.overtimeMinutes).toBe(y.months.reduce((s, m) => s + m.overtimeMinutes, 0));
    expect(y.total.overtimeMinutes).toBe(240);
  });

  it("pusty grafik daje same zera", () => {
    expect(yearSummary(data({}), 2026).total).toEqual({ minutes: 0, overtimeMinutes: 0, nightMinutes: 0, leaveDays: 0, sickDays: 0, earnings: 0 });
  });
});
