import { afterEach, describe, expect, it, vi } from "vitest";
import type { DebtEntry } from "./model";

const { fixture, addMock, removeMock, toastMock } = vi.hoisted(() => ({
  fixture: { entries: [] as DebtEntry[], plans: [] as { id: string; entryId: string; count: number }[], state: null as unknown, paid: null as unknown },
  addMock: vi.fn(),
  removeMock: vi.fn(),
  toastMock: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));
vi.mock("./store", () => ({ getDebts: () => fixture.entries, getDebtPlans: () => fixture.plans ?? [], debtPlanState: () => fixture.state, payDebtRate: () => fixture.paid, addDebt: (i: unknown) => addMock(i), removeDebt: (id: unknown) => removeMock(id) }));
vi.mock("sonner", () => ({ toast: toastMock }));

import { offerSettleFromNote } from "./settleFromNote";

const debt = (id: string, person: string, kind: DebtEntry["kind"], amount: number, over: Partial<DebtEntry> = {}): DebtEntry =>
  ({ id, person, kind, amount, at: "2026-10-10", note: "", created: 1, ...over }) as DebtEntry;

afterEach(() => { fixture.entries = []; fixture.plans = []; fixture.state = null; fixture.paid = null; addMock.mockReset(); removeMock.mockReset(); toastMock.mockReset(); toastMock.success.mockReset(); });

const action = () => (toastMock.mock.calls.at(-1)![1] as unknown as { action: { onClick: () => void } }).action;

describe("offerSettleFromNote (2.3)", () => {
  it("notatka „Zwrot od” → pytanie i spłata na kwotę salda z „Cofnij”", () => {
    fixture.entries = [debt("1", "Ania", "lent", 10_000, { dueNoteId: "n1" }), debt("2", "Ania", "repaid", 3_000)];
    addMock.mockImplementation((i: object) => ({ id: "s", ...i }));
    expect(offerSettleFromNote("n1")).toBe(true);
    expect(toastMock).toHaveBeenCalledWith("Oznaczyć jako oddane?", expect.objectContaining({ description: expect.stringContaining("70,00 zł") }));
    action().onClick();
    expect(addMock).toHaveBeenCalledWith({ person: "Ania", kind: "repaid", amount: 7_000, settle: true });
    (toastMock.success.mock.calls.at(-1)![1] as unknown as { action: { onClick: () => void } }).action.onClick();
    expect(removeMock).toHaveBeenCalledWith("s");
  });

  it("„Oddać” przy naszym długu → zwrot z naszej strony", () => {
    fixture.entries = [debt("1", "Marek", "borrowed", 4_000, { dueNoteId: "n2" })];
    addMock.mockImplementation((i: object) => ({ id: "s", ...i }));
    offerSettleFromNote("n2");
    action().onClick();
    expect(addMock).toHaveBeenCalledWith({ person: "Marek", kind: "returned", amount: 4_000, settle: true });
  });

  it("bez pytania: obca notatka, osoba rozliczona albo saldo po drugiej stronie", () => {
    fixture.entries = [debt("1", "Ania", "lent", 10_000, { dueNoteId: "n1" }), debt("2", "Ania", "repaid", 10_000)];
    expect(offerSettleFromNote("n1")).toBe(false);
    expect(offerSettleFromNote("inna")).toBe(false);
    fixture.entries = [debt("1", "Ania", "lent", 1_000, { dueNoteId: "n1" }), debt("2", "Ania", "borrowed", 5_000)];
    expect(offerSettleFromNote("n1")).toBe(false);
    expect(toastMock).not.toHaveBeenCalled();
  });

  it("notatka planu rat → „Rata wpłacona?” zamiast „Oznaczyć jako oddane?”; „Cofnij” woła undo raty", () => {
    fixture.entries = [debt("1", "Ania", "lent", 60_000, { dueNoteId: "n1" })];
    fixture.plans = [{ id: "p-1", entryId: "1", count: 6 }];
    fixture.state = { next: { k: 2, toPay: 10_000 } };
    const undo = vi.fn();
    fixture.paid = { entry: { amount: 10_000 }, k: 2, count: 6, undo };
    expect(offerSettleFromNote("n1")).toBe(true);
    expect(toastMock.mock.calls[0][0]).toBe("Rata wpłacona?");
    (toastMock.mock.calls[0][1] as { action: { onClick: () => void } }).action.onClick();
    expect(addMock).not.toHaveBeenCalled();
    (toastMock.success.mock.calls[0][1] as { action: { onClick: () => void } }).action.onClick();
    expect(undo).toHaveBeenCalled();
  });
});
