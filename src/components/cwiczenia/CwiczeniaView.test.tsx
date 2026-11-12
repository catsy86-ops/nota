import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { Supplement } from "@/lib/supplements/model";

// Magazyn odżywek i notatki podmieniamy atrapami: test sprawdza widok, nie Yjs ani Przypomnienia.
const fixture: { list: Supplement[]; taken: Set<string> } = { list: [], taken: new Set() };
const setTaken = vi.fn();
const { notesMock, addSupplementMock, removeSupplementMock, updateSupplementMock } = vi.hoisted(() => ({
  notesMock: { addNote: vi.fn(() => "note-1"), updateNote: vi.fn(), trashNote: vi.fn(), restoreFromTrash: vi.fn() },
  addSupplementMock: vi.fn(),
  updateSupplementMock: vi.fn((_id?: unknown, _edit?: unknown) => ({ id: "s1" })),
  removeSupplementMock: vi.fn((_id?: unknown) => null),
}));
vi.mock("@/hooks/NotesProvider", () => ({ useNotesContext: () => notesMock }));
vi.mock("@/lib/diet/store", () => ({
  useMeals: () => [],
  useDietGoals: () => ({}),
  addMeal: vi.fn(),
  removeMeal: vi.fn(),
  restoreMeal: vi.fn(),
  setDietGoals: vi.fn(),
}));
vi.mock("@/lib/supplements/store", () => ({
  useSupplements: () => fixture.list,
  useSupplementsTaken: () => fixture.taken,
  addSupplement: (input: unknown) => addSupplementMock(input),
  removeSupplement: (id: unknown) => removeSupplementMock(id),
  updateSupplement: (id: unknown, edit: unknown) => updateSupplementMock(id, edit),
  restoreSupplement: vi.fn(),
  setSupplementTaken: (...args: unknown[]) => setTaken(...args),
}));

import { CwiczeniaView } from "./CwiczeniaView";
import { logKey } from "@/lib/supplements/model";
import { localDayKey } from "@/lib/dayDone";

afterEach(() => {
  cleanup();
  fixture.list = [];
  fixture.taken = new Set();
  setTaken.mockClear();
  addSupplementMock.mockReset();
  removeSupplementMock.mockReset();
  updateSupplementMock.mockClear();
  removeSupplementMock.mockReturnValue(null);
  notesMock.addNote.mockClear();
  notesMock.updateNote.mockClear();
  notesMock.trashNote.mockClear();
});

const sup = (id: string, name: string, when: Supplement["when"], dose = "1 łyżka"): Supplement => ({ id, name, dose, when, created: 1 });

describe("CwiczeniaView — odżywki", () => {
  it("bez odżywek proponuje kreatynę", () => {
    render(<CwiczeniaView />);
    expect(screen.getByRole("button", { name: "Dodaj kreatynę (rano, 1 łyżka)" })).toBeTruthy();
  });

  it("grupuje według pory dnia i pokazuje dzisiejszy postęp", () => {
    fixture.list = [sup("k", "Kreatyna", "rano"), sup("o", "Omega", "wieczorem", "")];
    fixture.taken = new Set([logKey(localDayKey(), "k")]);
    render(<CwiczeniaView />);
    expect(screen.getByTestId("supplements-count").textContent).toBe("dziś 1 z 2");
    const rano = document.querySelector('[data-supplement-group="rano"]') as HTMLElement;
    expect(within(rano).getByText("Kreatyna")).toBeTruthy();
    expect(document.querySelector('[data-supplement-group="wieczorem"]')).toBeTruthy();
    expect(document.querySelector('[data-supplement-group="w_ciagu_dnia"]')).toBeNull();
  });

  it("odhaczenie wysyła dzisiejszy dzień i odżywkę", () => {
    fixture.list = [sup("k", "Kreatyna", "rano")];
    render(<CwiczeniaView />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Wzięte: Kreatyna" }));
    expect(setTaken).toHaveBeenCalledWith("k", true, localDayKey());
  });

  it("formularz blokuje zapis bez nazwy", () => {
    render(<CwiczeniaView />);
    fireEvent.click(screen.getByRole("button", { name: "Dodaj odżywkę" }));
    expect((screen.getByRole("button", { name: "Dodaj" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("dodanie z przypomnieniem tworzy notatkę z dziennym powtarzaniem i zapisuje jej id", () => {
    addSupplementMock.mockImplementation((input: { name: string }) => ({ id: "s1", ...input }));
    render(<CwiczeniaView />);
    fireEvent.click(screen.getByRole("button", { name: "Dodaj odżywkę" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nazwa odżywki" }), { target: { value: "Kreatyna" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Dawka" }), { target: { value: "1 łyżka" } });
    fireEvent.click(screen.getByRole("button", { name: "Dodaj" }));
    expect(notesMock.addNote).toHaveBeenCalledWith("Kreatyna — 1 łyżka", expect.any(String), "default", ["ćwiczenia"], expect.any(Number));
    expect(notesMock.updateNote).toHaveBeenCalledWith("note-1", { reminderRepeat: "daily" });
    expect(addSupplementMock).toHaveBeenCalledWith(expect.objectContaining({ name: "Kreatyna", reminderNoteId: "note-1", remindAt: "07:30" }));
  });

  describe("edycja odżywki (2.6)", () => {
    const sup = { id: "s1", name: "Kreatyna", dose: "1 łyżka", when: "rano" as const, created: 1, remindAt: "07:30", reminderNoteId: "old-note" };
    const openEdit = () => {
      fixture.list = [sup];
      render(<CwiczeniaView />);
      fireEvent.click(screen.getByRole("button", { name: "Edytuj Kreatyna" }));
    };

    it("zmiana samej nazwy i dawki aktualizuje tytuł istniejącej notatki, bez nowej", () => {
      openEdit();
      fireEvent.change(screen.getByRole("textbox", { name: "Nazwa odżywki" }), { target: { value: "Magnez" } });
      fireEvent.click(screen.getByRole("button", { name: "Zapisz zmiany" }));
      expect(notesMock.updateNote).toHaveBeenCalledWith("old-note", { title: "Magnez — 1 łyżka" });
      expect(notesMock.addNote).not.toHaveBeenCalled();
      expect(updateSupplementMock).toHaveBeenCalledWith("s1", expect.objectContaining({ name: "Magnez", remindAt: "07:30", reminderNoteId: "old-note" }));
    });

    it("zmiana godziny przenosi przypomnienie: nowa notatka, stara do kosza", () => {
      openEdit();
      fireEvent.change(screen.getByLabelText("Godzina przypomnienia"), { target: { value: "09:15" } });
      fireEvent.click(screen.getByRole("button", { name: "Zapisz zmiany" }));
      expect(notesMock.addNote).toHaveBeenCalledWith("Kreatyna — 1 łyżka", expect.any(String), "default", ["ćwiczenia"], expect.any(Number));
      expect(notesMock.trashNote).toHaveBeenCalledWith("old-note");
      expect(updateSupplementMock).toHaveBeenCalledWith("s1", expect.objectContaining({ remindAt: "09:15", reminderNoteId: "note-1" }));
    });

    it("wyłączenie przypomnienia wyrzuca notatkę i czyści pole", () => {
      openEdit();
      fireEvent.click(screen.getByRole("checkbox", { name: /Przypominaj codziennie/ }));
      fireEvent.click(screen.getByRole("button", { name: "Zapisz zmiany" }));
      expect(notesMock.trashNote).toHaveBeenCalledWith("old-note");
      expect(notesMock.addNote).not.toHaveBeenCalled();
      expect(updateSupplementMock).toHaveBeenCalledWith("s1", expect.objectContaining({ remindAt: undefined, reminderNoteId: undefined }));
    });
  });

  it("odrzucony zapis sprząta świeżo utworzone przypomnienie", () => {
    addSupplementMock.mockReturnValue(null);
    render(<CwiczeniaView />);
    fireEvent.click(screen.getByRole("button", { name: "Dodaj odżywkę" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nazwa odżywki" }), { target: { value: "Omega" } });
    fireEvent.click(screen.getByRole("button", { name: "Dodaj" }));
    expect(notesMock.trashNote).toHaveBeenCalledWith("note-1");
  });

  it("bez zaznaczonego przypomnienia nie tworzy notatki", () => {
    addSupplementMock.mockImplementation((input: object) => ({ id: "s2", ...input }));
    render(<CwiczeniaView />);
    fireEvent.click(screen.getByRole("button", { name: "Dodaj odżywkę" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nazwa odżywki" }), { target: { value: "Omega" } });
    fireEvent.click(screen.getByLabelText(/Przypominaj codziennie/));
    fireEvent.click(screen.getByRole("button", { name: "Dodaj" }));
    expect(notesMock.addNote).not.toHaveBeenCalled();
    expect(addSupplementMock).toHaveBeenCalledWith(expect.objectContaining({ name: "Omega", remindAt: undefined }));
  });
});
