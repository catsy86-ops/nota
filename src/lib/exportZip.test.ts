import { describe, expect, it } from "vitest";
import { buildNotesZip, buildZip, noteToMarkdownFile, safeFileName } from "./exportZip";
import { listZip } from "./import/zip";
import type { Folder, Note } from "@/hooks/useNotes";
import type { PropDef } from "@/lib/noteProps";

const note = (o: Partial<Note>): Note => ({
  id: "1", title: "", content: "", color: "default", pinned: false, archived: false, trashed: false, trashedAt: null,
  labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null, order: 0, createdAt: 0, updatedAt: 0, ...o,
});

describe("exportZip", () => {
  it("czyści nazwy plików", () => {
    expect(safeFileName('a/b:c*"d"')).toBe("a b c d");
    expect(safeFileName("   ")).toBe("Bez tytułu");
    expect(safeFileName("..ukryty")).toBe("ukryty");
  });

  it("frontmatter niesie tytuł, etykiety i listę zadań z wcięciem", () => {
    const md = noteToMarkdownFile(note({
      title: 'Plan "A"', labels: ["praca", "dom"], content: "treść",
      checklist: [{ id: "a", text: "jedno", checked: false }, { id: "b", text: "pod", checked: true, indent: 1 }],
    }));
    expect(md).toContain('title: "Plan \\"A\\""');
    expect(md).toContain('tags: ["praca", "dom"]');
    expect(md).toContain("- [ ] jedno\n  - [x] pod");
  });

  it("archiwum da się odczytać czytnikiem ZIP z importu; foldery jako katalogi, duplikaty numerowane, prywatne pominięte", async () => {
    const folders: Folder[] = [{ id: "f1", name: "Praca", parentId: null } as Folder];
    const { bytes, count, skippedPrivate } = buildNotesZip([
      note({ id: "1", title: "Raport", content: "A", folderId: "f1" }),
      note({ id: "2", title: "Raport", content: "B", folderId: "f1" }),
      note({ id: "3", title: "Sekret", locked: true }),
      note({ id: "4", title: "Żółć", content: "ą" }),
    ], folders);
    expect(count).toBe(3);
    expect(skippedPrivate).toBe(1);
    const { entries } = listZip(bytes);
    expect(entries.map((e) => e.name).sort()).toEqual(["Praca/Raport (2).md", "Praca/Raport.md", "Żółć.md"]);
    const zolc = entries.find((e) => e.name === "Żółć.md")!;
    expect(new TextDecoder().decode(await zolc.read())).toContain("ą");
  });

  it("pusty zestaw daje poprawne puste archiwum", () => {
    expect(listZip(buildZip([])).entries).toEqual([]);
  });
});

describe("ikona w frontmatterze", () => {
  it("eksport zapisuje ikonę i ulubioną, a import je odczytuje", async () => {
    const { parseMarkdownNote } = await import("./import/markdown");
    const md = noteToMarkdownFile(note({ title: "Start", content: "x", icon: "🚀", favorite: true }));
    expect(md).toContain('icon: "🚀"');
    expect(md).toContain("favorite: true");
    const parsed = parseMarkdownNote(md, { path: "Start.md" });
    expect(parsed.icon).toBe("🚀");
    expect(parsed.favorite).toBe(true);
  });

  it("import odrzuca zbyt długą „ikonę” i nie dokłada pól, gdy ich nie ma", async () => {
    const { parseMarkdownNote } = await import("./import/markdown");
    const parsed = parseMarkdownNote('---\nicon: "to nie jest emoji"\n---\ntreść', { path: "A.md" });
    expect(parsed.icon).toBeUndefined();
    expect(parsed.favorite).toBeUndefined();
  });

  it("pola z wartością trafiają do jednego klucza `props`, puste pomijane; nazwa pola nie nadpisuje `title`", async () => {
    const defs: PropDef[] = [
      { id: "a", name: "title", type: "text", order: 1 },
      { id: "b", name: "Cena", type: "number", order: 0 },
      { id: "c", name: "Status", type: "select", options: ["x"], order: 2 },
    ];
    const md = noteToMarkdownFile(note({ title: "Ofert", props: { a: "t", b: 12.5 } }), defs);
    expect(md).toContain('title: "Ofert"');
    expect(md).toContain('props: {"Cena":"12,5","title":"t"}');
    expect(noteToMarkdownFile(note({ title: "Pusta", props: {} }), defs)).not.toContain("props:");
    // czytnik importu zostawia zwykłe pola nietknięte
    const { parseFrontmatter } = await import("./import/markdown");
    const parsed = parseFrontmatter(md).data;
    expect(parsed.title).toBe("Ofert");
  });
});
