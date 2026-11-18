import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createYShifts } from "@/lib/shifts/yShifts";
import { createScheduleRegistry } from "@/lib/shifts/schedules";
import { createYTraining } from "@/lib/training/yTraining";
import { createYjsStore, yjsStore } from "@/lib/yjsStore";
import { saveView, viewFromCurrent } from "@/lib/savedViews";
import { getViewPrefs } from "@/lib/viewPrefs";

// D1.1 (`docs/plan-migracje-yjs-2026-11-15.md`): pole nowszej wersji (`xFuture`) przeżywa zapis na tej wersji
// w Grafiku, rejestrze grafików, ustawieniach treningu, folderach i właściwościach notatek.

describe("D1.1 Grafik", () => {
  it("dzień: zmiana rodzaju i pełny wpis zostawiają pole", () => {
    const doc = new Y.Doc();
    const y = createYShifts(doc);
    doc.getMap("shiftDays").set("2026-11-18", { type: "d", xFuture: 1 });
    y.setDayShift("2026-11-18", "n");
    expect(doc.getMap("shiftDays").get("2026-11-18")).toMatchObject({ type: "n", xFuture: 1 });
    y.setDayEntry("2026-11-18", { type: "d", note: "x" });
    expect(doc.getMap("shiftDays").get("2026-11-18")).toMatchObject({ type: "d", note: "x", xFuture: 1 });
  });

  it("rodzaj zmiany, wzór i premia: zapis zostawia pole", () => {
    const doc = new Y.Doc();
    const y = createYShifts(doc);
    const t = { id: "t1", name: "Dzień", short: "D", color: "sky", start: "06:00", end: "14:00", breakMin: 0 };
    y.saveShiftType(t as never);
    doc.getMap("shiftTypes").set("t1", { ...(doc.getMap("shiftTypes").get("t1") as object), xFuture: "t" });
    y.saveShiftType({ ...t, name: "Ranna" } as never);
    expect(doc.getMap("shiftTypes").get("t1")).toMatchObject({ name: "Ranna", xFuture: "t" });
    const p = { id: "p1", name: "4-brygadowy", steps: ["t1", null] };
    y.savePattern(p as never);
    doc.getMap("shiftPatterns").set("p1", { ...(doc.getMap("shiftPatterns").get("p1") as object), xFuture: "p" });
    y.savePattern({ ...p, name: "Cztery" } as never);
    expect(doc.getMap("shiftPatterns").get("p1")).toMatchObject({ name: "Cztery", xFuture: "p" });
    const b = { id: "b1", month: "2026-11", name: "Premia", amount: 100 };
    y.saveBonus(b);
    doc.getMap("shiftBonuses").set("b1", { ...b, xFuture: "b" });
    y.saveBonus({ ...b, amount: 200 });
    expect(doc.getMap("shiftBonuses").get("b1")).toMatchObject({ amount: 200, xFuture: "b" });
  });

  it("rejestr grafików: zmiana nazwy zostawia pole", () => {
    const doc = new Y.Doc();
    const r = createScheduleRegistry(doc);
    const s = r.add("Żona")!;
    doc.getMap("shiftSchedules").set(s.id, { ...s, xFuture: 1 });
    r.rename(s.id, "Ola");
    expect(doc.getMap("shiftSchedules").get(s.id)).toEqual({ id: s.id, name: "Ola", xFuture: 1 });
  });
});

describe("D1.1 trening: przypomnienie i sprzęt", () => {
  it("zapis zostawia pole", () => {
    const doc = new Y.Doc();
    const y = createYTraining(doc);
    doc.getMap("trainingMeta").set("reminder", { time: "18:00", xFuture: 1 });
    doc.getMap("trainingMeta").set("equipment", { dumbbellMaxKg: 10, xFuture: 2 });
    y.setReminder({ time: "19:00" });
    y.setEquipment({ dumbbellMaxKg: 12 });
    expect(doc.getMap("trainingMeta").get("reminder")).toEqual({ time: "19:00", xFuture: 1 });
    expect(doc.getMap("trainingMeta").get("equipment")).toEqual({ dumbbellMaxKg: 12, xFuture: 2 });
  });
});

describe("D1.1 notatki: folder i właściwość", () => {
  it("ponowny zapis mapy pól zostawia klucz nowszej wersji", () => {
    const store = createYjsStore(`d11-${crypto.randomUUID()}`);
    const folder = { id: "f1", name: "Dom", color: "default", emoji: null, parentId: null, order: 0, createdAt: 1 };
    store.upsertFolder(folder as never);
    (store.doc.getMap("folders").get("f1") as Y.Map<unknown>).set("xFuture", "f");
    store.upsertFolder({ ...folder, name: "Mieszkanie" } as never);
    const y = store.doc.getMap("folders").get("f1") as Y.Map<unknown>;
    expect(y.get("name")).toBe("Mieszkanie");
    expect(y.get("xFuture")).toBe("f");
    store.upsertPropDef({ id: "k", name: "Kto", type: "text", order: 0 } as never);
    (store.doc.getMap("propDefs").get("k") as Y.Map<unknown>).set("xFuture", "d");
    store.upsertPropDef({ id: "k", name: "Klient", type: "text", order: 0 } as never);
    expect((store.doc.getMap("propDefs").get("k") as Y.Map<unknown>).get("xFuture")).toBe("d");
  });
});

describe("D1.1 zapisane widoki", () => {
  it("ponowny zapis widoku zostawia pole", () => {
    const v = viewFromCurrent("vx", "Budowa", { kind: "all" }, "", getViewPrefs(), 10)!;
    expect(saveView(v)).toBe(true);
    const map = yjsStore.doc.getMap("views");
    map.set("vx", { ...(map.get("vx") as object), xFuture: 1 });
    expect(saveView({ ...v, name: "Budowa 2" })).toBe(true);
    expect(map.get("vx")).toMatchObject({ name: "Budowa 2", xFuture: 1 });
  });
});
