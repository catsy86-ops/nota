import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { convergenceProperty, convergenceRuns, runScript, type ConvergenceDomain, type Step } from "@/test/convergence";
import { createYShifts, type DeletedShiftType } from "./yShifts";
import { DEFAULT_SHIFT_TYPES, type DayEntry, type ShiftType } from "./model";
import { monthSummary } from "./summary";

/**
 * Z-17.9 §3.3: zbieżność Grafiku. Projekcja = `get()` (rodzaje i cykle w kolejności z `order`, dni, ustawienia)
 * oraz podsumowanie listopada z `monthSummary` — kwoty mają się zgadzać, nie tylko dni.
 */

type Store = { y: ReturnType<typeof createYShifts>; deleted: DeletedShiftType[]; lastWrite: Record<string, DayEntry | null> | null };
type Op =
  | { k: "paint"; day: string; type: string | null }
  | { k: "note"; day: string; note: string }
  | { k: "write"; days: Record<string, string | null> }
  | { k: "undoWrite" }
  | { k: "newType"; id: string }
  | { k: "editHours"; id: string; start: string }
  | { k: "deleteType"; id: string }
  | { k: "restoreType" }
  | { k: "newPattern"; id: string; steps: (string | null)[] }
  | { k: "deletePattern"; id: string }
  | { k: "rate"; value: number };

const DAYS = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"];
const BASE_TYPES = DEFAULT_SHIFT_TYPES.map((t) => t.id);
const newTypeIds = (d: number) => [`t${d}a`, `t${d}b`];
const ALL_TYPES = [...BASE_TYPES, ...[0, 1, 2].flatMap(newTypeIds)];
const newPatternIds = (d: number) => [`p${d}a`];
const ALL_PATTERNS = [0, 1, 2].flatMap(newPatternIds);
const typeOf = (id: string): ShiftType => ({ id, name: id, short: id.slice(0, 2), color: "#123456", start: "06:00", end: "14:00", breakMin: 0 });

const shifts: ConvergenceDomain<Store, Op> = {
  name: "Grafik",
  create: (doc) => ({ y: createYShifts(doc), deleted: [], lastWrite: null }),
  ops: (device) => fc.oneof(
    { weight: 4, arbitrary: fc.record({ k: fc.constant("paint" as const), day: fc.constantFrom(...DAYS), type: fc.constantFrom<string | null>(...ALL_TYPES, null) }) },
    { weight: 2, arbitrary: fc.record({ k: fc.constant("note" as const), day: fc.constantFrom(...DAYS), note: fc.constantFrom("", "zastępstwo", "wcześniej") }) },
    { weight: 1, arbitrary: fc.dictionary(fc.constantFrom(...DAYS), fc.constantFrom<string | null>("e", "b", null), { maxKeys: 3 }).map((days): Op => ({ k: "write", days })) },
    { weight: 1, arbitrary: fc.constant({ k: "undoWrite" } as Op) },
    { weight: 2, arbitrary: fc.record({ k: fc.constant("newType" as const), id: fc.constantFrom(...newTypeIds(device)) }) },
    { weight: 1, arbitrary: fc.record({ k: fc.constant("editHours" as const), id: fc.constantFrom(...ALL_TYPES), start: fc.constantFrom("06:00", "07:00") }) },
    { weight: 1, arbitrary: fc.record({ k: fc.constant("deleteType" as const), id: fc.constantFrom(...ALL_TYPES) }) },
    { weight: 1, arbitrary: fc.constant({ k: "restoreType" } as Op) },
    { weight: 1, arbitrary: fc.record({ k: fc.constant("newPattern" as const), id: fc.constantFrom(...newPatternIds(device)), steps: fc.array(fc.constantFrom<string | null>("e", "b", null), { minLength: 1, maxLength: 3 }) }) },
    { weight: 1, arbitrary: fc.record({ k: fc.constant("deletePattern" as const), id: fc.constantFrom(...ALL_PATTERNS) }) },
    { weight: 1, arbitrary: fc.record({ k: fc.constant("rate" as const), value: fc.constantFrom(30, 35) }) },
  ),
  apply: (s, op) => {
    const y = s.y;
    switch (op.k) {
      case "paint": if (op.type === null || y.get().types.some((t) => t.id === op.type)) y.setDayShift(op.day, op.type); break;
      case "note": { const cur = y.get().days[op.day]; if (cur) y.setDayEntry(op.day, { ...cur, note: op.note || undefined }); break; }
      case "write": s.lastWrite = y.writeDays(Object.fromEntries(Object.entries(op.days).map(([k, t]) => [k, t ? { type: t } : null]))); break;
      // „Cofnij” z tostu: przywraca tylko dni z ostatniego zapisu tego urządzenia.
      case "undoWrite": if (s.lastWrite) { y.writeDays(s.lastWrite); s.lastWrite = null; } break;
      case "newType": y.saveShiftType(typeOf(op.id), "2026-11-04"); break;
      case "editHours": { const t = y.get().types.find((x) => x.id === op.id); if (t) y.saveShiftType({ ...t, start: op.start }, "2026-11-04"); break; }
      case "deleteType": { const d = y.deleteShiftType(op.id); if (d) s.deleted.push(d); break; }
      case "restoreType": { const d = s.deleted.pop(); if (d) y.restoreShiftType(d); break; }
      case "newPattern": y.savePattern({ id: op.id, name: op.id, steps: op.steps }); break;
      case "deletePattern": y.deletePattern(op.id); break;
      case "rate": y.setMeta("hourlyRate", op.value); break;
    }
  },
  project: (s) => {
    const data = s.y.get();
    const sum = monthSummary(data, 2026, 10);
    return { types: data.types.map((t) => ({ id: t.id, start: t.start, order: t.order })), patterns: data.patterns.map((p) => ({ id: p.id, steps: p.steps })), days: data.days, rate: data.hourlyRate, summary: sum };
  },
  invariants: (p) => {
    const { types, patterns } = p as { types: { id: string }[]; patterns: { id: string }[] };
    const out: string[] = [];
    if (new Set(types.map((t) => t.id)).size !== types.length) out.push("zdublowany rodzaj zmiany");
    if (new Set(patterns.map((x) => x.id)).size !== patterns.length) out.push("zdublowany cykl");
    return out;
  },
};

describe("zbieżność Grafiku (Z-17.9)", () => {
  // §6.1: dwa telefony bez łączności nadają ten sam `order` (`nextOrder` z lokalnego stanu); bez rozstrzygnięcia remisu
  // kolejność rodzajów zależała od kolejności odbioru (W1) — znalezione tym zestawem 2026-11-26, remis rozstrzyga id.
  it("losowe przebiegi na 2–3 telefonach: projekcja z podsumowaniem miesiąca, zimny start, spokój, niezmienniki", () => {
    fc.assert(convergenceProperty(shifts), { numRuns: convergenceRuns() });
  });

  it("obowiązkowy: dwa telefony bez łączności dodają po rodzaju zmiany (ten sam `order`) — kolejność wszędzie ta sama", () => {
    const steps: Step<Op>[] = [
      { k: "op", d: 0, op: { k: "newType", id: "t0a" } },
      { k: "op", d: 1, op: { k: "newType", id: "t1a" } },
    ];
    expect(runScript(shifts, steps)).toEqual({ ok: true });
  });

  it("obowiązkowy: A usuwa rodzaj startowy, B równolegle pierwszy raz zmienia rodzaje — wynik równy", () => {
    const steps: Step<Op>[] = [
      { k: "op", d: 0, op: { k: "deleteType", id: "l4" } },
      { k: "op", d: 1, op: { k: "newType", id: "t1a" } },
    ];
    expect(runScript(shifts, steps)).toEqual({ ok: true });
  });

  it("obowiązkowy: A zmienia notatkę dnia, B równolegle maluje ten dzień inną zmianą — wynik równy", () => {
    const steps: Step<Op>[] = [
      { k: "op", d: 0, op: { k: "paint", day: "2026-11-02", type: "e" } },
      { k: "deliver", from: 0, to: 1, n: 10 },
      { k: "op", d: 0, op: { k: "note", day: "2026-11-02", note: "zastępstwo" } },
      { k: "op", d: 1, op: { k: "paint", day: "2026-11-02", type: "b" } },
    ];
    expect(runScript(shifts, steps)).toEqual({ ok: true });
  });
});
