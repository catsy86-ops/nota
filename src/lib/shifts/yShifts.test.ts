import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { createYShifts } from "./yShifts";
import { DEFAULT_SHIFT_TYPES, EMPTY_SHIFT_DATA } from "./model";

/** Dwa „telefony” i wymiana stanu w obie strony — jak po spotkaniu w sieci. */
function pair() {
  const a = new Y.Doc();
  const b = new Y.Doc();
  const sync = () => {
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a, Y.encodeStateVector(b)));
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b, Y.encodeStateVector(a)));
  };
  return { a: createYShifts(a), b: createYShifts(b), sync };
}

describe("Grafik w Yjs", () => {
  it("świeży dokument pokazuje startowe rodzaje, nic nie zapisując", () => {
    const doc = new Y.Doc();
    const s = createYShifts(doc);
    expect(s.get().types.map((t) => t.id)).toEqual(DEFAULT_SHIFT_TYPES.map((t) => t.id));
    expect(doc.getMap("shiftTypes").size).toBe(0);
  });

  it("Budowa dochodzi raz do istniejących rodzajów, nie wraca po usunięciu, pusty zestaw zostaje pusty", () => {
    const withTypes = createYShifts(new Y.Doc());
    withTypes.saveShiftType({ ...DEFAULT_SHIFT_TYPES[0], name: "Ranna" });
    withTypes.deleteShiftType("b");
    // Zapis bez „b” — jak grafik sprzed dodania Budowy.
    expect(withTypes.get().types.some((t) => t.id === "b")).toBe(false);
    withTypes.addPresetOnce("presetBudowa", "b");
    expect(withTypes.get().types.at(-1)).toMatchObject({ id: "b", name: "Budowa", start: "07:00", end: "17:00" });
    withTypes.deleteShiftType("b");
    withTypes.addPresetOnce("presetBudowa", "b");
    expect(withTypes.get().types.some((t) => t.id === "b")).toBe(false);

    const empty = createYShifts(new Y.Doc());
    empty.replaceAll({ ...EMPTY_SHIFT_DATA, types: [] });
    empty.addPresetOnce("presetBudowa", "b");
    expect(empty.get().types).toEqual([]);
  });

  it("dni malowane na dwóch urządzeniach scalają się", () => {
    const { a, b, sync } = pair();
    a.setDayShift("2026-10-01", "d");
    b.setDayShift("2026-10-02", "n");
    sync();
    expect(a.get().days).toEqual({ "2026-10-01": { type: "d" }, "2026-10-02": { type: "n" } });
    expect(b.get().days).toEqual(a.get().days);
  });

  it("poprawka startowego rodzaju nie ginie przy spotkaniu ze świeżym urządzeniem", () => {
    const { a, b, sync } = pair();
    a.saveShiftType({ ...DEFAULT_SHIFT_TYPES[0], color: "#000000" });
    b.setDayShift("2026-10-01", "d");
    sync();
    expect(b.get().types[0].color).toBe("#000000");
    expect(b.get().types.map((t) => t.id)).toEqual(DEFAULT_SHIFT_TYPES.map((t) => t.id));
  });

  it("nowy rodzaj ląduje na końcu na obu urządzeniach", () => {
    const { a, b, sync } = pair();
    a.saveShiftType({ ...DEFAULT_SHIFT_TYPES[0], id: "x", name: "Dwunastka" });
    sync();
    expect(b.get().types.at(-1)?.id).toBe("x");
  });

  it("Cofnij po usunięciu rodzaju nie kasuje dni dodanych w międzyczasie", () => {
    const { a, b, sync } = pair();
    a.setDayShift("2026-10-01", "d");
    sync();
    const removed = a.deleteShiftType("d")!;
    expect(removed.days).toEqual({ "2026-10-01": { type: "d" } });
    b.setDayShift("2026-10-05", "n");
    sync();
    a.restoreShiftType(removed);
    sync();
    expect(b.get().days).toEqual({ "2026-10-01": { type: "d" }, "2026-10-05": { type: "n" } });
    expect(b.get().types.some((t) => t.id === "d")).toBe(true);
  });

  it("cofnięcie dni przywraca tylko je, nie cały grafik", () => {
    const { a, b, sync } = pair();
    const before = a.writeDays({ "2026-10-01": { type: "d" }, "2026-10-02": null });
    b.setDayShift("2026-10-09", "n");
    sync();
    a.writeDays(before);
    expect(a.get().days).toEqual({ "2026-10-09": { type: "n" } });
  });

  it("migracja dokłada stare dane bez nadpisywania tego, co już przyszło", () => {
    const s = createYShifts(new Y.Doc());
    s.setDayShift("2026-10-01", "n");
    const old = { ...EMPTY_SHIFT_DATA, hourlyRate: 30, days: { "2026-10-01": { type: "d" }, "2026-10-02": { type: "d" } } };
    s.mergeIn(old, "tel-1");
    s.mergeIn(old, "tel-1");
    expect(s.isMerged("tel-1")).toBe(true);
    expect(s.isMerged("tel-2")).toBe(false);
    expect(s.get().days).toEqual({ "2026-10-01": { type: "n" }, "2026-10-02": { type: "d" } });
    expect(s.get().hourlyRate).toBe(30);
    expect(s.get().types).toHaveLength(DEFAULT_SHIFT_TYPES.length);
  });

  it("zmiana godzin rodzaju nie przelicza dni sprzed dziś", () => {
    const s = createYShifts(new Y.Doc());
    s.setDayShift("2026-10-01", "d");
    s.setDayShift("2026-10-20", "d");
    s.saveShiftType({ ...DEFAULT_SHIFT_TYPES[0], start: "07:00", end: "15:30" }, "2026-10-09");
    expect(s.get().days["2026-10-01"].hours).toEqual({ start: "06:00", end: "14:00", breakMin: 0 });
    expect(s.get().days["2026-10-20"].hours).toBeUndefined();
    // Druga zmiana godzin nie nadpisuje już zapamiętanych.
    s.saveShiftType({ ...DEFAULT_SHIFT_TYPES[0], start: "08:00", end: "16:00" }, "2026-10-09");
    expect(s.get().days["2026-10-01"].hours?.start).toBe("06:00");
    // Zmiana nazwy czy koloru nie rusza dni.
    s.setDayShift("2026-10-02", "d");
    s.saveShiftType({ ...s.get().types[0], color: "#000000" }, "2026-10-09");
    expect(s.get().days["2026-10-02"].hours).toBeUndefined();
  });

  it("migawka ma stałą tożsamość, dopóki nic się nie zmieni", () => {
    const s = createYShifts(new Y.Doc());
    const first = s.get();
    expect(s.get()).toBe(first);
    s.setMeta("hourlyRate", 25);
    expect(s.get()).not.toBe(first);
    expect(s.get().hourlyRate).toBe(25);
  });
});
