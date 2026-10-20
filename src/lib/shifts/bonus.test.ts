import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { cleanBonus, DEFAULT_SHIFT_TYPES, EMPTY_SHIFT_DATA, migrate, type ShiftBonus, type ShiftData } from "./model";
import { monthSummary } from "./summary";
import { createYShifts } from "./yShifts";

const bonus = (id: string, month: string, amount: number, name = "Nagroda"): ShiftBonus => ({ id, month, name, amount });

const base: ShiftData = {
  ...EMPTY_SHIFT_DATA,
  types: DEFAULT_SHIFT_TYPES,
  hourlyRate: 30,
  days: { "2026-10-05": { type: "d" }, "2026-10-06": { type: "d" } },
};

describe("cleanBonus", () => {
  it("przycina nazwę, zaokrągla do groszy i odrzuca złe dane", () => {
    expect(cleanBonus({ id: "b1", month: "2026-10", name: "  Premia  ", amount: 150.456 })).toEqual({ id: "b1", month: "2026-10", name: "Premia", amount: 150.46 });
    expect(cleanBonus({ id: "b1", month: "2026-13", name: "x", amount: 10 })).toBeNull();
    expect(cleanBonus({ id: "b1", month: "2026-10", name: "x", amount: 0 })).toBeNull();
    expect(cleanBonus({ id: "b1", month: "2026-10", name: "  ", amount: 10 })).toBeNull();
    expect(cleanBonus({ id: "b1", month: "2026-10", name: "x", amount: "dużo" })).toBeNull();
  });
});

describe("premie w zarobku miesiąca", () => {
  it("premia tego miesiąca dolicza się do zarobku co do grosza, inne miesiące bez zmian", () => {
    const without = monthSummary(base, 2026, 9).earnings;
    const withBonus = monthSummary({ ...base, bonuses: [bonus("b1", "2026-10", 500)] }, 2026, 9);
    expect(withBonus.earnings).toBe(Math.round((without + 500) * 100) / 100);
    expect(withBonus.bonusTotal).toBe(500);
    expect(withBonus.bonuses.map((b) => b.id)).toEqual(["b1"]);
    expect(monthSummary({ ...base, bonuses: [bonus("b1", "2026-10", 500)] }, 2026, 10).earnings).toBe(monthSummary(base, 2026, 10).earnings);
  });

  it("kilka premii w miesiącu się sumuje", () => {
    const s = monthSummary({ ...base, bonuses: [bonus("a", "2026-10", 100), bonus("b", "2026-10", 25.5)] }, 2026, 9);
    expect(s.bonusTotal).toBe(125.5);
  });
});

describe("migrate i premie", () => {
  it("zachowuje poprawne premie i odrzuca śmieci z kopii", () => {
    const m = migrate({ bonuses: [bonus("ok", "2026-10", 300), { id: "zla", month: "zle", name: "x", amount: 1 }, null] });
    expect(m.bonuses.map((b) => b.id)).toEqual(["ok"]);
    expect(migrate({}).bonuses).toEqual([]);
  });
});

describe("premie w dokumencie Yjs", () => {
  it("zapis, poprawka i usunięcie premii; usunięcie zwraca ją do cofnięcia", () => {
    const y = createYShifts(new Y.Doc());
    expect(y.saveBonus(bonus("b1", "2026-10", 200))).toBe(true);
    expect(y.get().bonuses).toHaveLength(1);
    expect(y.saveBonus(bonus("b1", "2026-10", 250))).toBe(true);
    expect(y.get().bonuses[0].amount).toBe(250);
    const prev = y.deleteBonus("b1");
    expect(prev?.amount).toBe(250);
    expect(y.get().bonuses).toEqual([]);
  });

  it("zamiana całego grafiku zabiera premie, a scalanie dokłada tylko brakujące", () => {
    const y = createYShifts(new Y.Doc());
    y.saveBonus(bonus("lokalna", "2026-10", 10));
    y.mergeIn({ ...base, bonuses: [bonus("lokalna", "2026-10", 999), bonus("z-kopii", "2026-10", 20)] });
    expect(y.get().bonuses.map((b) => [b.id, b.amount]).sort()).toEqual([["lokalna", 10], ["z-kopii", 20]]);
    y.replaceAll({ ...base, bonuses: [bonus("tylko", "2026-10", 30)] });
    expect(y.get().bonuses.map((b) => b.id)).toEqual(["tylko"]);
  });
});
