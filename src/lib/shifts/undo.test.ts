import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createYShifts, SHIFTS_SYSTEM_ORIGIN } from "./yShifts";

describe("Cofnij w Grafiku (Ctrl+Z)", () => {
  it("Ponów (Ctrl+Shift+Z) przywraca cofniętą zmianę, a nowa zmiana czyści stos ponawiania", () => {
    const doc = new Y.Doc();
    const inst = createYShifts(doc);
    inst.setDayShift("2026-10-06", "day");
    inst.undo();
    expect(inst.canRedo()).toBe(true);
    expect(inst.redo()).toBe(true);
    expect(inst.get().days["2026-10-06"]?.type).toBe("day");
    inst.undo();
    inst.setDayShift("2026-10-08", "night");
    expect(inst.canRedo()).toBe(false);
  });

  it("cofa lokalną zmianę dnia", () => {
    const doc = new Y.Doc();
    const inst = createYShifts(doc);
    inst.setDayShift("2026-10-06", "day");
    expect(inst.get().days["2026-10-06"]?.type).toBe("day");
    expect(inst.canUndo()).toBe(true);
    expect(inst.undo()).toBe(true);
    expect(inst.get().days["2026-10-06"]).toBeUndefined();
    expect(inst.canUndo()).toBe(false);
  });

  it("nie cofa zmian z innego źródła (sync)", () => {
    const doc = new Y.Doc();
    const inst = createYShifts(doc);
    doc.transact(() => inst.writeDays({ "2026-10-07": { type: "night" } }), "remote-peer");
    expect(inst.get().days["2026-10-07"]?.type).toBe("night");
    expect(inst.canUndo()).toBe(false);
    expect(inst.undo()).toBe(false);
    expect(inst.get().days["2026-10-07"]?.type).toBe("night");
  });

  it("zapis systemowy (przywracanie, import) nie trafia na stos", () => {
    const doc = new Y.Doc();
    const inst = createYShifts(doc);
    inst.writeDays({ "2026-10-08": { type: "day" } }, SHIFTS_SYSTEM_ORIGIN);
    expect(inst.get().days["2026-10-08"]?.type).toBe("day");
    expect(inst.canUndo()).toBe(false);
  });
});
