import { afterEach, describe, expect, it, vi } from "vitest";
import type { DebtEntry } from "./model";

const { fixture, addMock, removeMock, toastMock } = vi.hoisted(() => ({
  fixture: { entries: [] as DebtEntry[] },
  addMock: vi.fn(),
  removeMock: vi.fn(),
  toastMock: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));
vi.mock("./store", () => ({ getDebts: () => fixture.entries, addDebt: (i: unknown) => addMock(i), removeDebt: (id: unknown) => removeMock(id) }));
vi.mock("sonner", () => ({ toast: toastMock }));

import { offerSettleFromNote } from "./settleFromNote";

const debt = (id: string, person: string, kind: DebtEntry["kind"], amount: number, over: Partial<DebtEntry> = {}): DebtEntry =>
  ({ id, person, kind, amount, at: "2026-10-10", note: "", created: 1, ...over }) as DebtEntry;

afterEach(() => { fixture.entries = []; addMock.mockReset(); removeMock.mockReset(); toastMock.mockReset(); toastMock.success.mockReset(); });

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
});
