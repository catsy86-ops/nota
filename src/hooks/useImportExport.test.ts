import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useImportExport } from "./useImportExport";
import { importFromJSON } from "@/lib/exportNotes";
import { toast } from "sonner";
import type { Note } from "@/hooks/useNotes";

vi.mock("@/lib/exportNotes", () => ({
  importFromJSON: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "1", title: "T", content: "C", color: "default", pinned: false,
    archived: false, trashed: false, trashedAt: null, labels: [], reminder: null,
    priority: "none", images: [], checklist: [], folderId: null, order: 0,
    createdAt: 0, updatedAt: 0, ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/");
});

describe("useImportExport — handleImport", () => {
  it("imports notes from the file picker flow and shows a success toast", async () => {
    const imported = [makeNote({ id: "a" }), makeNote({ id: "b" })];
    vi.mocked(importFromJSON).mockResolvedValue(imported);
    const importNotes = vi.fn();

    const { result } = renderHook(() => useImportExport(importNotes, vi.fn()));
    await act(async () => { await result.current.handleImport(); });

    expect(importNotes).toHaveBeenCalledWith(imported);
    expect(toast.success).toHaveBeenCalledWith("Zaimportowano 2 notatek");
  });

  it("silently does nothing when the user cancels the file picker", async () => {
    vi.mocked(importFromJSON).mockRejectedValue(new Error("Nie wybrano pliku"));
    const importNotes = vi.fn();

    const { result } = renderHook(() => useImportExport(importNotes, vi.fn()));
    await act(async () => { await result.current.handleImport(); });

    expect(importNotes).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("shows an error toast for a real import failure", async () => {
    vi.mocked(importFromJSON).mockRejectedValue(new Error("Nieprawidłowy format"));
    const importNotes = vi.fn();

    const { result } = renderHook(() => useImportExport(importNotes, vi.fn()));
    await act(async () => { await result.current.handleImport(); });

    expect(toast.error).toHaveBeenCalledWith("Błąd importu: Nieprawidłowy format");
  });
});

describe("useImportExport — ?share= link handling", () => {
  it("decodes a share link, adds the note and strips the query param", async () => {
    const payload = { t: "Tytuł", c: "Treść", co: "mint", l: ["dom"], cl: [] };
    const encoded = btoa(encodeURIComponent(JSON.stringify(payload)));
    window.history.replaceState({}, "", `/?share=${encoded}`);
    const addNote = vi.fn();

    renderHook(() => useImportExport(vi.fn(), addNote));

    await waitFor(() => expect(addNote).toHaveBeenCalledWith("Tytuł", "Treść", "mint", ["dom"], null, [], []));
    expect(toast.success).toHaveBeenCalledWith("Zaimportowano udostępnioną notatkę!");
    expect(window.location.search).toBe("");
  });

  it("shows an error toast and does not add a note for a malformed share link", async () => {
    window.history.replaceState({}, "", "/?share=not-valid-base64!!!");
    const addNote = vi.fn();

    renderHook(() => useImportExport(vi.fn(), addNote));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Nieprawidłowy link udostępniania"));
    expect(addNote).not.toHaveBeenCalled();
  });

  it("does nothing when there is no ?share= param", () => {
    const addNote = vi.fn();
    renderHook(() => useImportExport(vi.fn(), addNote));

    expect(addNote).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
});
