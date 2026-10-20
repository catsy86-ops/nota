import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { cleanScheduleName, createScheduleRegistry, MAIN_SCHEDULE_NAME, SCHEDULES_MAX, SCHEDULE_NAME_MAX } from "./schedules";
import { createYShifts, MAIN_SCHEDULE_ID, shiftsMapName } from "./yShifts";

describe("nazwy i nazewnictwo map", () => {
  it("nazwa jest przycinana i nie może być pusta", () => {
    expect(cleanScheduleName("  Dorobek   weekendowy  ")).toBe("Dorobek weekendowy");
    expect(cleanScheduleName("   ")).toBeNull();
    expect(cleanScheduleName("x".repeat(100))?.length).toBe(SCHEDULE_NAME_MAX);
  });

  it("grafik główny używa dawnych nazw map, pozostałe mają prefiks", () => {
    expect(shiftsMapName(MAIN_SCHEDULE_ID, "shiftDays")).toBe("shiftDays");
    expect(shiftsMapName("s-1", "shiftDays")).toBe("s-1:shiftDays");
  });
});

describe("izolacja grafików", () => {
  it("zmiana w jednym grafiku nie pojawia się w drugim", () => {
    const doc = new Y.Doc();
    createYShifts(doc, MAIN_SCHEDULE_ID).setDayShift("2026-10-05", "d");
    createYShifts(doc, "s-dorobek").setDayShift("2026-10-06", "n");
    expect(Object.keys(createYShifts(doc, MAIN_SCHEDULE_ID).get().days)).toEqual(["2026-10-05"]);
    expect(Object.keys(createYShifts(doc, "s-dorobek").get().days)).toEqual(["2026-10-06"]);
  });
});

describe("rejestr grafików", () => {
  it("grafik główny jest zawsze pierwszy i ma domyślną nazwę", () => {
    const reg = createScheduleRegistry(new Y.Doc());
    expect(reg.list()).toEqual([{ id: MAIN_SCHEDULE_ID, name: MAIN_SCHEDULE_NAME }]);
  });

  it("dodawanie, sortowanie po nazwie, zmiana nazwy", () => {
    const reg = createScheduleRegistry(new Y.Doc());
    reg.add("Zeta", "s-z");
    reg.add("Alfa", "s-a");
    expect(reg.list().map((s) => s.name)).toEqual([MAIN_SCHEDULE_NAME, "Alfa", "Zeta"]);
    expect(reg.rename("s-z", "Beta")).toBe(true);
    expect(reg.list().map((s) => s.name)).toEqual([MAIN_SCHEDULE_NAME, "Alfa", "Beta"]);
  });

  it("grafik główny da się przemianować, ale nie usunąć", () => {
    const reg = createScheduleRegistry(new Y.Doc());
    expect(reg.rename(MAIN_SCHEDULE_ID, "Praca")).toBe(true);
    expect(reg.list()[0].name).toBe("Praca");
    expect(reg.remove(MAIN_SCHEDULE_ID)).toBe(false);
    expect(reg.has(MAIN_SCHEDULE_ID)).toBe(true);
  });

  it("usunięcie grafiku czyści jego dane (rodzaje, dni, cykle, premie)", () => {
    const doc = new Y.Doc();
    const reg = createScheduleRegistry(doc);
    reg.add("Dorobek", "s-d");
    createYShifts(doc, "s-d").setDayShift("2026-10-05", "d");
    expect(reg.remove("s-d")).toBe(true);
    expect(reg.has("s-d")).toBe(false);
    expect(createYShifts(doc, "s-d").get().days).toEqual({});
  });

  it("limit grafików i pusta nazwa nie dodają grafiku", () => {
    const reg = createScheduleRegistry(new Y.Doc());
    expect(reg.add("   ")).toBeNull();
    for (let i = 1; i < SCHEDULES_MAX; i++) expect(reg.add(`G${i}`, `s-${i}`)).not.toBeNull();
    expect(reg.add("za dużo")).toBeNull();
  });

  it("lista ma stabilny obiekt, dopóki rejestr się nie zmieni", () => {
    const reg = createScheduleRegistry(new Y.Doc());
    const first = reg.list();
    expect(reg.list()).toBe(first);
    reg.add("Nowy", "s-n");
    expect(reg.list()).not.toBe(first);
  });
});
