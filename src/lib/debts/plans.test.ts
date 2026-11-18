import { describe, expect, it } from "vitest";
import fc from "fast-check";
import * as Y from "yjs";
import { getNextReminderTime } from "@/lib/reminderRepeat";
import { localDayKey } from "@/lib/dayDone";
import { balances, DEBT_KINDS, KIND_SIGN, type DebtEntry, type DebtKind } from "./model";
import { allocate, cleanPlan, planState, rateAmounts, rateDue, rateEntryId, syncPlanNote, type DebtPlan } from "./plans";
import { createYDebts } from "./yDebts";

const plan = (over: Partial<DebtPlan> = {}): DebtPlan => ({ id: "p-1", entryId: "loan", count: 6, day: 10, first: "2026-01-10", created: 1, ...over });
let seq = 0;
const e = (kind: DebtKind, amount: number, at = "2026-01-01", over: Partial<DebtEntry> = {}): DebtEntry => ({ id: `e${++seq}`, person: "Jan", kind, amount, at, note: "", created: seq, ...over });

describe("rateDue", () => {
  it("dzień 29/30/31 przez 12 miesięcy zgodny z getNextReminderTime (monthly, anchorDay)", () => {
    for (const day of [29, 30, 31]) {
      for (const start of ["2026-01", "2027-11", "2028-01"]) {
        const p = plan({ day, count: 12, first: rateDue({ first: `${start}-01`, day }, 1) });
        let t = new Date(`${p.first}T09:00:00`).getTime();
        for (let k = 1; k <= 12; k++) {
          expect(rateDue(p, k)).toBe(localDayKey(new Date(t)));
          t = getNextReminderTime(t, "monthly", day);
        }
      }
    }
  });
});

describe("rateAmounts", () => {
  it("suma równa kwocie co do grosza, ostatnia dopełnia", () => {
    fc.assert(fc.property(fc.integer({ min: 2, max: 60 }), fc.integer({ min: 2, max: 100_000_000 }), (n, total) => {
      const a = rateAmounts(total, n);
      expect(a.reduce((s, x) => s + x, 0)).toBe(total);
      expect(a.slice(0, -1).every((x) => x === a[0])).toBe(true);
    }));
    expect(rateAmounts(100, 3)).toEqual([33, 33, 34]);
  });
});

describe("allocate i planState", () => {
  it("niezmiennik: suma niepokrytych długów minus nadpłata = saldo osoby", () => {
    const arb = fc.array(fc.record({ kind: fc.constantFrom(...DEBT_KINDS), amount: fc.integer({ min: 1, max: 100_000 }), day: fc.integer({ min: 1, max: 28 }) }), { maxLength: 30 });
    fc.assert(fc.property(arb, (rows) => {
      const entries = rows.map((r, i) => ({ id: `x${i}`, person: "Jan", kind: r.kind, amount: r.amount, at: `2026-01-${String(r.day).padStart(2, "0")}`, note: "", created: i }));
      const balance = balances(entries)[0]?.balance ?? 0;
      for (const sign of [1, -1] as const) {
        const { covered, credit } = allocate(entries, sign);
        const open = entries.filter((x) => KIND_SIGN[x.kind] === sign).reduce((s, x) => s + x.amount - (covered.get(x.id) ?? 0), 0);
        expect(open - credit + 0).toBe(sign * balance + 0);
      }
    }));
  });

  it("rata częściowa, nadpłata, spłata ręczna liczy się tak samo", () => {
    const loan = e("lent", 60000, "2026-01-01", { id: "loan" });
    const p = plan();
    expect(planState(p, [loan], "2026-01-05")).toMatchObject({ done: 0, partial: 0, next: { k: 1, toPay: 10000, due: "2026-01-10" }, overdue: 0 });
    const s1 = planState(p, [loan, e("repaid", 15000, "2026-01-08")], "2026-02-20")!;
    expect(s1).toMatchObject({ done: 1, partial: 5000, next: { k: 2, toPay: 5000 }, overdue: 1 });
    expect(planState(p, [loan, e("repaid", 70000)], "2026-01-05")).toMatchObject({ finished: true, next: null });
    // Pożyczka zmniejszona poniżej spłaconego — plan zakończony.
    expect(planState(p, [{ ...loan, amount: 20000 }, e("repaid", 30000)])?.finished).toBe(true);
  });

  it("najstarszy dług pierwszy: spłata najpierw pokrywa wcześniejszą pożyczkę", () => {
    const old = e("lent", 10000, "2025-12-01");
    const loan = e("lent", 60000, "2026-01-01", { id: "loan" });
    expect(planState(plan(), [old, loan, e("repaid", 10000, "2026-01-05")])!.paid).toBe(0);
    expect(planState(plan(), [old, loan, e("repaid", 20000, "2026-01-05")])!.paid).toBe(10000);
  });

  it("plan na „Pożyczyłem od” lustrzanie", () => {
    const loan = e("borrowed", 60000, "2026-01-01", { id: "loan" });
    expect(planState(plan(), [loan, e("returned", 10000)])!.done).toBe(1);
  });

  it("cleanPlan odrzuca złe liczby rat i dni", () => {
    expect(cleanPlan(plan())).not.toBeNull();
    expect(cleanPlan(plan({ count: 1 }))).toBeNull();
    expect(cleanPlan(plan({ count: 61 }))).toBeNull();
    expect(cleanPlan(plan({ day: 32 }))).toBeNull();
    expect(cleanPlan(plan({ first: "2026-13-01" }))).toBeNull();
  });
});

describe("syncPlanNote", () => {
  const at = (day: string, h = 9) => new Date(`${day}T${String(h).padStart(2, "0")}:00:00`).getTime();
  const state = (paid: number) => planState(plan(), [e("lent", 60000, "2026-01-01", { id: "loan" }), ...(paid ? [e("repaid", paid)] : [])])!;

  it("rata przed terminem przesuwa na następną, o godzinie serii; nigdy wstecz", () => {
    const note = { reminder: at("2026-01-10", 8), reminderRepeat: "monthly" as const };
    expect(syncPlanNote(plan(), state(10000), note)).toEqual({ reminder: at("2026-02-10", 8), reminderDay: 10, reminderBase: undefined });
    expect(syncPlanNote(plan(), state(0), { ...note, reminder: at("2026-03-10") })).toBeNull();
  });

  it("jednorazowa, w koszu albo brak notatki — bez zmian; zakończony — termin zdjęty", () => {
    expect(syncPlanNote(plan(), state(10000), { reminder: at("2026-01-10"), reminderRepeat: "none" })).toBeNull();
    expect(syncPlanNote(plan(), state(10000), { reminder: at("2026-01-10"), reminderRepeat: "monthly", trashed: true })).toBeNull();
    expect(syncPlanNote(plan(), state(10000), null)).toBeNull();
    expect(syncPlanNote(plan(), state(60000), { reminder: at("2026-01-10"), reminderRepeat: "monthly" })).toEqual({ reminder: null });
  });
});

describe("dwa telefony", () => {
  it("ten sam klucz raty z dwóch dokumentów daje jeden wpis", () => {
    const a = new Y.Doc();
    const b = new Y.Doc();
    const ya = createYDebts(a);
    const yb = createYDebts(b);
    const loan = e("lent", 60000, "2026-01-01", { id: "loan" });
    ya.add(loan);
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    const id = rateEntryId("p-1", 1);
    ya.add(e("repaid", 10000, "2026-01-05", { id, created: 10 }));
    yb.add(e("repaid", 10000, "2026-01-05", { id, created: 11 }));
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    expect(ya.get().filter((x) => x.id === id)).toHaveLength(1);
    expect(yb.get()).toHaveLength(2);
  });

  it("usunięcie pożyczki usuwa plan; „Cofnij” go oddaje; sierota niewidoczna", () => {
    const y = createYDebts(new Y.Doc());
    const loan = e("lent", 60000, "2026-01-01", { id: "loan" });
    y.add(loan);
    expect(y.addPlan(plan())).toBe(true);
    expect(y.plans()).toHaveLength(1);
    const prev = y.remove("loan")!;
    expect(y.plans()).toHaveLength(0);
    y.restore(prev);
    expect(y.plans()).toHaveLength(1);
    expect(y.addPlan(plan({ id: "p-2", entryId: "brak" }))).toBe(false);
  });
});
