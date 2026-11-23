import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { dialogsReducer, useAppDialogs, type DialogsState } from "./useAppDialogs";

const base = (): DialogsState => ({
  open: { palette: false, actions: false, settings: false, stats: false, quickInbox: false, shortcuts: false, propDefs: false, focusMode: false, triage: false, emptyTrash: false },
  triageMounted: false,
  deleteIds: null,
});

describe("dialogsReducer (A2.4)", () => {
  it("przełącza okno wartością i funkcją jak setState", () => {
    const a = dialogsReducer(base(), { type: "set", name: "palette", open: true });
    expect(a.open.palette).toBe(true);
    expect(dialogsReducer(a, { type: "set", name: "palette", open: (o) => !o }).open.palette).toBe(false);
  });

  it("bez zmiany zwraca ten sam stan (brak zbędnego renderu)", () => {
    const s = base();
    expect(dialogsReducer(s, { type: "set", name: "stats", open: false })).toBe(s);
  });

  it("triaż zostaje zamontowany po zamknięciu", () => {
    const opened = dialogsReducer(base(), { type: "set", name: "triage", open: true });
    const closed = dialogsReducer(opened, { type: "set", name: "triage", open: false });
    expect(closed.triageMounted).toBe(true);
    expect(closed.open.triage).toBe(false);
  });

  it("potwierdzenie trwałego usunięcia trzyma listę id", () => {
    const s = dialogsReducer(base(), { type: "confirmDelete", ids: ["a", "b"] });
    expect(s.deleteIds).toEqual(["a", "b"]);
    expect(dialogsReducer(s, { type: "confirmDelete", ids: null }).deleteIds).toBeNull();
  });
});

describe("useAppDialogs", () => {
  it("settery są stałe między renderami i aktualizują flagi", () => {
    const { result, rerender } = renderHook(() => useAppDialogs());
    const set = result.current.setConfirmEmptyTrash;
    act(() => set(true));
    rerender();
    expect(result.current.confirmEmptyTrash).toBe(true);
    expect(result.current.setConfirmEmptyTrash).toBe(set);
  });
});
