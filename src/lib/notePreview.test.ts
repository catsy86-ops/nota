import { describe, it, expect } from "vitest";
import { notePreview, PREVIEW_CHARS } from "./notePreview";
import type { Note } from "@/hooks/useNotes";

const note = (over: Partial<Note>): Note => ({ id: "n", title: "", content: "", locked: false, ...over }) as unknown as Note;

describe("podgląd notatki w kalendarzu (K3.5)", () => {
  it("tytuł i początek treści", () => {
    expect(notePreview(note({ title: "Dentysta", content: "Zabrać kartę" }))).toBe("Dentysta\nZabrać kartę");
  });

  it("bez tytułu i bez treści — sam tytuł zastępczy", () => {
    expect(notePreview(note({}))).toBe("Bez tytułu");
  });

  it("notatka prywatna: treść nie trafia do podglądu", () => {
    expect(notePreview(note({ title: "Tajne", content: "hasło 123", locked: true }))).toBe("Notatka prywatna");
  });

  it("długa treść ucinana z wielokropkiem", () => {
    const out = notePreview(note({ title: "T", content: "a".repeat(PREVIEW_CHARS + 50) }));
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThan(PREVIEW_CHARS + 10);
  });
});
