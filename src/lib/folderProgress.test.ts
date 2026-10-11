import { describe, expect, it } from "vitest";
import type { Folder, Note } from "@/hooks/useNotes";
import { folderProgress, noteProgress } from "@/lib/folderProgress";

const note = (p: Partial<Note>): Note => ({
  id: "n", title: "", content: "", color: "default", pinned: false, archived: false, trashed: false, trashedAt: null,
  labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null, order: 0, createdAt: 0, updatedAt: 0, ...p,
} as Note);
const folder = (id: string, parentId: string | null = null) => ({ id, name: id, parentId } as Folder);

describe("noteProgress", () => {
  it("liczy listę kontrolną i pola zadań z treści, pomijając bloki kodu", () => {
    const n = note({
      checklist: [{ id: "a", text: "x", checked: true }, { id: "b", text: "y", checked: false }],
      content: "- [x] a\n- [ ] b\n```\n- [ ] w kodzie\n```\n1. [ ] c\nzwykły tekst",
    });
    expect(noteProgress(n)).toEqual({ done: 2, total: 5 });
  });

  it("notatka prywatna nie ujawnia liczb", () => {
    expect(noteProgress(note({ locked: true, content: "- [ ] a" }))).toEqual({ done: 0, total: 0 });
  });
});

describe("folderProgress", () => {
  it("sumuje podfoldery i pomija archiwum, kosz oraz foldery bez zadań", () => {
    const folders = [folder("p"), folder("c", "p"), folder("pusty")];
    const notes = [
      note({ id: "1", folderId: "p", content: "- [x] a" }),
      note({ id: "2", folderId: "c", content: "- [ ] b\n- [x] c" }),
      note({ id: "3", folderId: "c", archived: true, content: "- [ ] zarchiwizowane" }),
      note({ id: "4", folderId: "pusty", content: "bez zadań" }),
    ];
    const map = folderProgress(notes, folders);
    expect(map.get("c")).toEqual({ done: 1, total: 2 });
    expect(map.get("p")).toEqual({ done: 2, total: 3 });
    expect(map.has("pusty")).toBe(false);
  });
});
