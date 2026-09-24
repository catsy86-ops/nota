import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNoteActions, type NoteActionsDeps } from "./useNoteActions";
import type { Note } from "@/hooks/useNotes";
import type { useConfirmAction } from "@/components/ConfirmActionDialog";

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "1",
    title: "Tytuł",
    content: "Treść",
    color: "default",
    pinned: false,
    archived: false,
    trashed: false,
    trashedAt: null,
    labels: [],
    reminder: null,
    priority: "none",
    images: [],
    checklist: [],
    folderId: null,
    order: 0,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

// Runs the action immediately, bypassing the confirmation dialog — matches
// the real useConfirmAction's behavior when the "ask before X" pref is off.
const confirmAction: ReturnType<typeof useConfirmAction>["confirmAction"] = (action) => action.run();

function setup(overrides: Partial<NoteActionsDeps> = {}) {
  const deps: NoteActionsDeps = {
    notes: [makeNote({ id: "n1", title: "Note 1" }), makeNote({ id: "n2", title: "Note 2" })],
    archivedNotes: [],
    selectedIds: new Set(["n1", "n2"]),
    confirmAction,
    clearSelection: vi.fn(),
    trashNote: vi.fn(),
    restoreFromTrash: vi.fn(),
    archiveNote: vi.fn(),
    unarchiveNote: vi.fn(),
    bulkTrash: vi.fn(),
    bulkArchive: vi.fn(),
    bulkSetColor: vi.fn(),
    bulkRestore: vi.fn(),
    setSelectedIds: vi.fn(),
    displayNotes: [makeNote({ id: "n1" }), makeNote({ id: "n2" }), makeNote({ id: "n3" })],
    ...overrides,
  };
  const { result } = renderHook(() => useNoteActions(deps));
  return { result, deps };
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("useNoteActions — single note actions", () => {
  it("handleTrashSingle trashes the note and wires a working undo", () => {
    const { result, deps } = setup();
    act(() => result.current.handleTrashSingle("n1"));

    expect(deps.trashNote).toHaveBeenCalledWith("n1");
    expect(deps.restoreFromTrash).not.toHaveBeenCalled();
  });

  it("handleArchiveSingle archives the note", () => {
    const { result, deps } = setup();
    act(() => result.current.handleArchiveSingle("n2"));

    expect(deps.archiveNote).toHaveBeenCalledWith("n2");
  });
});

describe("useNoteActions — bulk actions", () => {
  it("handleBulkTrash trashes every selected id and clears selection", () => {
    const { result, deps } = setup({ selectedIds: new Set(["n1", "n2"]) });
    act(() => result.current.handleBulkTrash());

    expect(deps.bulkTrash).toHaveBeenCalledWith(["n1", "n2"]);
    expect(deps.clearSelection).toHaveBeenCalled();
  });

  it("handleBulkArchive archives every selected id and clears selection", () => {
    const { result, deps } = setup({ selectedIds: new Set(["n1"]) });
    act(() => result.current.handleBulkArchive());

    expect(deps.bulkArchive).toHaveBeenCalledWith(["n1"]);
    expect(deps.clearSelection).toHaveBeenCalled();
  });

  it("handleBulkColor sets the color for every selected id and clears selection", () => {
    const { result, deps } = setup({ selectedIds: new Set(["n1", "n2"]) });
    act(() => result.current.handleBulkColor("mint"));

    expect(deps.bulkSetColor).toHaveBeenCalledWith(["n1", "n2"], "mint");
    expect(deps.clearSelection).toHaveBeenCalled();
  });

  it("handleSelectAll selects every currently displayed note id", () => {
    const { result, deps } = setup();
    act(() => result.current.handleSelectAll());

    expect(deps.setSelectedIds).toHaveBeenCalledWith(new Set(["n1", "n2", "n3"]));
  });
});

describe("useNoteActions — bulkPreview", () => {
  it("joins up to 4 note titles/content snippets for a preview string", () => {
    const { result } = setup({
      notes: [
        makeNote({ id: "a", title: "Alpha" }),
        makeNote({ id: "b", title: "", content: "Beta body text" }),
        makeNote({ id: "c", title: "Gamma" }),
      ],
    });
    expect(result.current.bulkPreview(["a", "b", "c"])).toBe("Alpha • Beta body text • Gamma");
  });

  it("skips ids that don't resolve to a note", () => {
    const { result } = setup({ notes: [makeNote({ id: "a", title: "Alpha" })] });
    expect(result.current.bulkPreview(["a", "missing"])).toBe("Alpha");
  });
});
