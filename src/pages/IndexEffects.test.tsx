import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Note } from "@/lib/types/note";

const mocks = vi.hoisted(() => ({
  loadNoteReader: vi.fn(() => Promise.resolve()),
  loadShiftPresets: vi.fn(() => Promise.resolve()),
  registerUndoHandlers: vi.fn(),
  markNoteOpened: vi.fn(),
  setSearchTerms: vi.fn(),
  step: vi.fn<(dir: -1 | 1, exists: (id: string) => boolean) => string | null>(),
}));
vi.mock("./indexViews", () => ({ loadNoteReader: mocks.loadNoteReader }));
vi.mock("@/hooks/useShiftPresets", () => ({ loadShiftPresets: mocks.loadShiftPresets }));
vi.mock("@/lib/actionHistory", () => ({ registerUndoHandlers: mocks.registerUndoHandlers }));
vi.mock("@/lib/lastOpened", () => ({ markNoteOpened: mocks.markNoteOpened }));
vi.mock("@/lib/searchTerms", () => ({ setSearchTerms: mocks.setSearchTerms }));
vi.mock("@/lib/noteHistory", () => ({ noteHistory: { step: mocks.step } }));

import { IdleWarmup, MarkOpenedSync, ReaderHistoryKeys, SearchTermsSync, UndoHandlersSync } from "./IndexEffects";

const note = (id: string, locked = false) => ({ id, locked }) as Note;
const ref = <T,>(current: T) => ({ current });

beforeEach(() => vi.clearAllMocks());

describe("IndexEffects (A2.2)", () => {
  it("IdleWarmup ładuje czytnik i presety Grafiku po bezczynności, nie od razu", () => {
    vi.useFakeTimers();
    const w = window as unknown as { requestIdleCallback?: unknown };
    const saved = w.requestIdleCallback;
    w.requestIdleCallback = undefined;
    try {
      render(<IdleWarmup />);
      expect(mocks.loadNoteReader).not.toHaveBeenCalled();
      act(() => { vi.advanceTimersByTime(1500); });
      expect(mocks.loadNoteReader).toHaveBeenCalledOnce();
      expect(mocks.loadShiftPresets).toHaveBeenCalledOnce();
    } finally {
      w.requestIdleCallback = saved;
      vi.useRealTimers();
    }
  });

  it("SearchTermsSync podaje frazy wyszukiwania przy każdej zmianie", () => {
    const { rerender } = render(<SearchTermsSync search="rura" />);
    expect(mocks.setSearchTerms).toHaveBeenLastCalledWith(["rura"]);
    rerender(<SearchTermsSync search="" />);
    expect(mocks.setSearchTerms).toHaveBeenLastCalledWith([]);
  });

  it("UndoHandlersSync rejestruje przywracanie z kosza i z archiwum", () => {
    const restore = vi.fn();
    const unarchive = vi.fn();
    render(<UndoHandlersSync restore={restore} unarchive={unarchive} />);
    const h = mocks.registerUndoHandlers.mock.calls[0][0] as { trash: (ids: string[]) => void; archive: (ids: string[]) => void };
    h.trash(["a"]);
    h.archive(["b", "c"]);
    expect(restore).toHaveBeenCalledWith(["a"]);
    expect(unarchive.mock.calls.map((c) => c[0])).toEqual(["b", "c"]);
  });

  it("MarkOpenedSync zapisuje otwarcie tylko przy otwartej notatce", () => {
    const { rerender } = render(<MarkOpenedSync noteId={null} />);
    expect(mocks.markNoteOpened).not.toHaveBeenCalled();
    rerender(<MarkOpenedSync noteId="n1" />);
    expect(mocks.markNoteOpened).toHaveBeenCalledWith("n1");
  });

  describe("ReaderHistoryKeys", () => {
    const setup = () => {
      const show = vi.fn();
      render(<ReaderHistoryKeys notesRef={ref([note("a"), note("tajna", true)])} archivedRef={ref([note("b")])} show={show} />);
      return show;
    };

    it("Alt+← idzie wstecz po notatkach, które istnieją i nie są zablokowane", () => {
      mocks.step.mockImplementation((_dir, exists) => (exists("tajna") ? "tajna" : exists("b") ? "b" : null));
      const show = setup();
      const e = new KeyboardEvent("keydown", { key: "ArrowLeft", altKey: true, cancelable: true });
      window.dispatchEvent(e);
      expect(mocks.step.mock.calls[0][0]).toBe(-1);
      expect(show).toHaveBeenCalledWith("b");
      expect(e.defaultPrevented).toBe(true);
    });

    it("bez kroku w historii zostawia skrót przeglądarce", () => {
      mocks.step.mockReturnValue(null);
      const show = setup();
      const e = new KeyboardEvent("keydown", { key: "ArrowRight", altKey: true, cancelable: true });
      window.dispatchEvent(e);
      expect(show).not.toHaveBeenCalled();
      expect(e.defaultPrevented).toBe(false);
    });

    it("pomija pole tekstowe i otwarte okno", () => {
      mocks.step.mockReturnValue("a");
      const show = setup();
      const input = document.createElement("input");
      document.body.appendChild(input);
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", altKey: true, bubbles: true }));
      const dialog = document.createElement("div");
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("data-state", "open");
      document.body.appendChild(dialog);
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", altKey: true }));
      expect(show).not.toHaveBeenCalled();
      input.remove();
      dialog.remove();
    });
  });
});
