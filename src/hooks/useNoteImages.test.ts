import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { Note } from "@/hooks/useNotes";

// Import plików podstawiony: test sprawdza, co hook robi z wynikiem (zdjęcia, załączniki, komunikat), nie samo zapisywanie.
const { importMock } = vi.hoisted(() => ({
  importMock: vi.fn(async (files: File[]) => ({
    images: files.filter((f) => f.type.startsWith("image/")).map((f) => `img:${f.name}`),
    attachments: files.filter((f) => f.type === "application/pdf").map((f) => ({ id: f.name, name: f.name, type: f.type, size: f.size, hash: f.name })),
    unsupported: [], skippedImages: 0, rejected: [],
  })),
}));
vi.mock("@/lib/inboxFiles", () => ({ importNoteFiles: importMock, warnImportedFiles: vi.fn() }));

import { useNoteImages } from "./useNoteImages";

const note = { id: "n1", images: ["old"], attachments: [] } as unknown as Note;
const file = (name: string, type: string) => new File(["x"], name, { type });
const dropEvent = (files: File[]) => ({
  dataTransfer: { files, types: files.length ? ["Files"] : ["text/plain"], dropEffect: "none" },
  preventDefault: vi.fn(), stopPropagation: vi.fn(),
}) as unknown as React.DragEvent<Element>;

describe("useNoteImages — pliki upuszczone na edytor (Notatki 2.6)", () => {
  it("obraz do zdjęć, PDF do załączników; zdarzenie nie dochodzi do pola tekstu", async () => {
    const onUpdate = vi.fn();
    const { result } = renderHook(() => useNoteImages({ note, onUpdate }));
    const e = dropEvent([file("a.png", "image/png"), file("b.pdf", "application/pdf")]);
    result.current.handleEditDrop(e);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(e.stopPropagation).toHaveBeenCalled();
    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
    const [id, patch] = onUpdate.mock.calls[0];
    expect(id).toBe("n1");
    expect(patch.images).toEqual(["old", "img:a.png"]);
    expect(patch.attachments.map((a: { name: string }) => a.name)).toEqual(["b.pdf"]);
  });

  it("przeciągany tekst (bez plików) idzie dalej bez zmian", () => {
    const onUpdate = vi.fn();
    const { result } = renderHook(() => useNoteImages({ note, onUpdate }));
    const e = dropEvent([]);
    result.current.handleEditDrop(e);
    expect(e.preventDefault).not.toHaveBeenCalled();
    const over = dropEvent([]);
    result.current.handleEditDragOver(over);
    expect(over.preventDefault).not.toHaveBeenCalled();
  });
});
