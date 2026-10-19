import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { JournalEntry } from "@/lib/study/yStudy";
import { clearJournalDraft, getJournalDraft, patchJournalDraft } from "@/lib/study/draft";
import { closeJournalSheet, openJournalEdit, openJournalSheet } from "@/lib/study/entrySheet";

const addJournalEntry = vi.fn();
const updateJournalEntry = vi.fn();
const removeJournalEntry = vi.fn();
const toastWithUndo = vi.fn();

vi.mock("@/lib/study/store", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/study/store")>();
  return {
    ...real,
    useStudy: () => ({ journal: [], sites: {}, site: "Dom Kowalski", custom: [], warnings: {} }),
    addJournalEntry: (...a: unknown[]) => addJournalEntry(...a),
    updateJournalEntry: (...a: unknown[]) => updateJournalEntry(...a),
    removeJournalEntry: (...a: unknown[]) => removeJournalEntry(...a),
    restoreJournalEntry: vi.fn(),
    setSite: vi.fn(),
    setSiteGeo: vi.fn(),
    setSiteShortages: vi.fn(),
    setSiteStages: vi.fn(),
    columnOf: () => "todo",
  };
});
vi.mock("@/lib/undoToast", () => ({ toastWithUndo: (...a: unknown[]) => toastWithUndo(...a) }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/hooks/useDictation", () => ({ useDictation: () => ({ supported: false, listening: false, toggle: vi.fn() }) }));
vi.mock("./HeightsSheet", () => ({ HeightsButton: () => null }));
vi.mock("./PressureTestFields", () => ({ PressureTestFields: () => null }));
vi.mock("./FittingsFields", () => ({ FittingsFields: () => null }));
vi.mock("@/components/DrawingCanvas", () => ({ DrawingCanvas: () => null }));
vi.mock("@/lib/storagePersistence", () => ({ requestPersistentStorage: vi.fn() }));

const { JournalEntrySheet } = await import("./JournalEntrySheet");

const renderSheet = () => render(<JournalEntrySheet onPractice={vi.fn()} />);
const textArea = () => document.querySelector("textarea") as HTMLTextAreaElement;

const savedEntry: JournalEntry = {
  id: "e1", at: new Date(2026, 9, 14, 12).getTime(), kind: "problem", topic: null, text: "Przeciek przy kolanie",
  site: "Dom Kowalski", siteId: "dom-kowalski", checked: [], images: [], fittings: [],
};

beforeEach(() => {
  addJournalEntry.mockReset().mockReturnValue(null);
  updateJournalEntry.mockReset();
  removeJournalEntry.mockReset();
  toastWithUndo.mockReset();
  // Rodzaj zostaje po zapisie (zamierzone), więc w teście czyścimy go jawnie.
  clearJournalDraft();
  patchJournalDraft({ kind: "ok" });
});

afterEach(() => {
  cleanup();
  closeJournalSheet();
});

describe("JournalEntrySheet — wpis z budowy", () => {
  it("nowy wpis: wybór rodzaju zapisuje się w szkicu", () => {
    openJournalSheet();
    renderSheet();
    expect(screen.getByText("Wpis z budowy")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Problem" }));
    expect(getJournalDraft().kind).toBe("problem");
  });

  it("pusty wpis nie zapisuje się i zostawia arkusz otwarty", () => {
    openJournalSheet();
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Zapisz wpis" }));

    expect(addJournalEntry).toHaveBeenCalledTimes(1);
    expect(addJournalEntry.mock.calls[0][0]).toMatchObject({ kind: "ok", text: "" });
    expect(screen.getByTestId("journal-entry-sheet")).toBeInTheDocument();
  });

  it("wpis z tekstem zapisuje się z rodzajem i zamyka arkusz", () => {
    addJournalEntry.mockReturnValue({ id: "n1", site: "Dom Kowalski", siteId: "dom-kowalski" });
    openJournalSheet();
    renderSheet();
    fireEvent.click(screen.getByRole("radio", { name: "Problem" }));
    fireEvent.change(textArea(), { target: { value: "Cieknie syfon" } });
    fireEvent.click(screen.getByRole("button", { name: "Zapisz wpis" }));

    expect(addJournalEntry).toHaveBeenCalledWith(expect.objectContaining({ kind: "problem", text: "Cieknie syfon" }));
    expect(screen.queryByTestId("journal-entry-sheet")).not.toBeInTheDocument();
  });

  it("edycja zapisanego wpisu pokazuje „Edytuj wpis” i zapisuje zmiany", () => {
    updateJournalEntry.mockReturnValue(savedEntry);
    openJournalEdit(savedEntry);
    renderSheet();
    expect(screen.getByText("Edytuj wpis")).toBeInTheDocument();
    expect(textArea().value).toBe("Przeciek przy kolanie");

    fireEvent.change(textArea(), { target: { value: "Przeciek naprawiony" } });
    fireEvent.click(screen.getByRole("button", { name: "Zapisz zmiany" }));

    expect(updateJournalEntry).toHaveBeenCalledWith("e1", expect.objectContaining({ text: "Przeciek naprawiony", kind: "problem" }));
  });

  it("„Usuń” w edycji kasuje wpis z możliwością cofnięcia", () => {
    removeJournalEntry.mockReturnValue(savedEntry);
    openJournalEdit(savedEntry);
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Usuń" }));

    expect(removeJournalEntry).toHaveBeenCalledWith("e1");
    expect(toastWithUndo).toHaveBeenCalledWith("Usunięto wpis", expect.any(Function), expect.anything());
  });
});
