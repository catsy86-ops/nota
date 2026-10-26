import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { createYWeight } from "./yWeight";
import { WEIGHT_MAX_ENTRIES } from "./model";

const w = (day: string, kg: number, created = 1) => ({ day, kg, created });

describe("masa ciała w Yjs (C-2)", () => {
  it("jeden wpis na dzień: nowe ważenie tego dnia nadpisuje poprzednie, lista od najstarszego", () => {
    const yw = createYWeight(new Y.Doc());
    expect(yw.set(w("2026-10-26", 81))).toBe(true);
    expect(yw.set(w("2026-10-20", 82))).toBe(true);
    expect(yw.set(w("2026-10-26", 80.5, 2))).toBe(true);
    expect(yw.get().map((e) => [e.day, e.kg])).toEqual([["2026-10-20", 82], ["2026-10-26", 80.5]]);
  });

  it("niepoprawny wpis nie trafia do dokumentu; usunięcie zwraca wpis do cofnięcia", () => {
    const yw = createYWeight(new Y.Doc());
    expect(yw.set(w("zły", 80))).toBe(false);
    yw.set(w("2026-10-26", 80));
    expect(yw.remove("2026-10-26")).toMatchObject({ day: "2026-10-26", kg: 80 });
    expect(yw.get()).toEqual([]);
    expect(yw.remove("2026-10-26")).toBeNull();
  });

  it("pełna historia nie przyjmuje nowego dnia, ale poprawia istniejący", () => {
    const yw = createYWeight(new Y.Doc());
    const pad = (n: number) => String(n).padStart(2, "0");
    const dayAt = (i: number) => {
      const d = new Date(2000, 0, 1 + i);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };
    for (let i = 0; i < WEIGHT_MAX_ENTRIES; i++) yw.set(w(dayAt(i), 80));
    expect(yw.set(w("2030-01-01", 80))).toBe(false);
    expect(yw.set(w(dayAt(0), 79, 2))).toBe(true);
  });

  it("scalanie z kopii: brakujące dni przychodzą, dla tego samego dnia wygrywa nowszy zapis", () => {
    const yw = createYWeight(new Y.Doc());
    yw.set(w("2026-10-26", 80, 10));
    yw.mergeDump([w("2026-10-26", 90, 5), w("2026-10-27", 79, 1), { day: "zły" }]);
    expect(yw.get().map((e) => [e.day, e.kg])).toEqual([["2026-10-26", 80], ["2026-10-27", 79]]);
    yw.mergeDump("śmieci");
    expect(yw.get()).toHaveLength(2);
  });
});
