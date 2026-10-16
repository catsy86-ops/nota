import { describe, it, expect } from "vitest";
import { noteToMarkdownFile } from "@/lib/exportZip";
import type { Note } from "@/hooks/useNotes";
import type { PropDef } from "@/lib/noteProps";
import { cleanTags, countImageEmbeds, extractTrailingTasks, parseFrontmatter, parseFrontmatterDate, parseMarkdownNote, parsePropsFrontmatter } from "./markdown";
import { MD_INLINE_TAGS_NOTE, MD_PLAIN_NOTE, OBSIDIAN_NOTE } from "./__fixtures__/samples";

describe("parseFrontmatter", () => {
  it("czyta skalary, listy w nawiasach i listy pod kluczem", () => {
    const { data, body } = parseFrontmatter(OBSIDIAN_NOTE);
    expect(data.title).toBe("Plan projektu");
    expect(data.tags).toEqual(["praca", "#pilne"]);
    expect(data.created).toBe("2024-02-10");
    expect(body.startsWith("# Plan projektu")).toBe(true);
    expect(parseFrontmatter(MD_INLINE_TAGS_NOTE).data.tags).toEqual(["dom", "#remont"]);
  });

  it("bez frontmattera zwraca całą treść (także z CRLF i BOM)", () => {
    expect(parseFrontmatter("\uFEFFtekst").body).toBe("tekst");
    expect(parseFrontmatter("---\r\ntitle: A\r\n---\r\nTreść").data.title).toBe("A");
  });

  it("niedomknięty frontmatter to zwykła treść", () => {
    const text = "---\ntitle: A\nbrak końca";
    expect(parseFrontmatter(text).body).toBe(text);
  });
});

describe("parseMarkdownNote", () => {
  it("składa notatkę Obsidiana: tytuł, tagi, daty, wikilinki i zadania", () => {
    const n = parseMarkdownNote(OBSIDIAN_NOTE, { path: "Vault/Plan projektu.md", lastModified: 1 });
    expect(n.title).toBe("Plan projektu");
    expect(n.labels).toEqual(["praca", "pilne"]);
    expect(n.createdAt).toBe(new Date(2024, 1, 10).getTime());
    expect(n.updatedAt).toBe(new Date(2024, 1, 12, 18, 30).getTime());
    expect(n.content).toBe("Zobacz [[Notatka o budżecie]] oraz [[Spotkanie|ze spotkania]].");
    expect(n.checklist).toEqual([{ text: "Wysłać ofertę", checked: false }, { text: "Zadzwonić do klienta", checked: true }]);
  });

  it("tytuł z nazwy pliku, gdy brak frontmattera; zdublowany H1 znika z treści", () => {
    const n = parseMarkdownNote("# Pomysł na weekend\n\nTreść", { path: "x/Pomysł na weekend.md" });
    expect(n.title).toBe("Pomysł na weekend");
    expect(n.content).toBe("Treść");
  });

  it("H1 różny od nazwy pliku zostaje w treści; data z pliku jako zapas", () => {
    const n = parseMarkdownNote(MD_PLAIN_NOTE, { path: "notatka.md", lastModified: 1700000000000 });
    expect(n.title).toBe("notatka");
    expect(n.content.startsWith("# Pomysł na weekend")).toBe(true);
    expect(n.createdAt).toBeNull();
    expect(n.updatedAt).toBe(1700000000000);
  });

  it("tytuł z H1, gdy nazwa pliku jest pusta", () => {
    const n = parseMarkdownNote("# Tytuł z nagłówka\ntekst", { path: ".md" });
    expect(n.title).toBe("Tytuł z nagłówka");
  });

  it("czyta datę ISO bez strefy jako czas lokalny", () => {
    const n = parseMarkdownNote(MD_INLINE_TAGS_NOTE, { path: "a.md" });
    expect(n.createdAt).toBe(new Date(2023, 10, 5, 8, 15).getTime());
    expect(n.labels).toEqual(["dom", "remont"]);
  });

  it("przenosi ścieżkę folderu", () => {
    expect(parseMarkdownNote("x", { path: "a/b.md", folderPath: ["a"] }).folderPath).toEqual(["a"]);
  });
});

describe("pomocnicze", () => {
  it("cleanTags usuwa # i duplikaty", () => {
    expect(cleanTags(["#a", "a", " b/c ", ""])).toEqual(["a", "b/c"]);
  });
  it("extractTrailingTasks bierze tylko końcowy blok", () => {
    const r = extractTrailingTasks("- [ ] a\ntekst\n\n- [x] b\n- [ ] c\n");
    expect(r.content).toBe("- [ ] a\ntekst");
    expect(r.checklist.map((c) => c.text)).toEqual(["b", "c"]);
  });
  it("parseFrontmatterDate odrzuca śmieci", () => {
    expect(parseFrontmatterDate("kiedyś")).toBeNull();
    expect(parseFrontmatterDate("2024-13-45")).toBeNull();
  });
  it("countImageEmbeds liczy lokalne obrazy", () => {
    expect(countImageEmbeds("![[a.png]] ![x](b.jpg) ![w](https://x/y.png)")).toBe(2);
  });
});

describe("parsePropsFrontmatter", () => {
  it("czyta mapę JSON z nazwami pól i liczbami zapisanymi tekstem", () => {
    expect(parsePropsFrontmatter('{"Cena": "1,5", "Status": "w toku", "Ilość": 3}')).toEqual({ Cena: "1,5", Status: "w toku", Ilość: 3 });
  });
  it("pomija zły JSON, tablice, puste wartości i typy inne niż tekst/liczba", () => {
    expect(parsePropsFrontmatter("{zły json")).toEqual({});
    expect(parsePropsFrontmatter('["a", "b"]')).toEqual({});
    expect(parsePropsFrontmatter('{"": "x", "Puste": "  ", "Null": null, "Zagn": {"a": 1}}')).toEqual({});
  });
  it("nie zamienia klucza __proto__ w prototyp", () => {
    const out = parsePropsFrontmatter('{"__proto__": "x", "Ok": "tak"}');
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(out).toEqual({ Ok: "tak" });
  });
  it("parseMarkdownNote podaje props tylko gdy są, bez wpływu na resztę", () => {
    const withProps = parseMarkdownNote('---\ntitle: "Zakup"\nprops: {"Cena": "12,50"}\n---\nTreść', { path: "Zakup.md" });
    expect(withProps.props).toEqual({ Cena: "12,50" });
    expect(withProps.title).toBe("Zakup");
    expect("props" in parseMarkdownNote(MD_PLAIN_NOTE, { path: "Pomysł.md" })).toBe(false);
  });
});

describe("eksport ZIP → import właściwości", () => {
  it("plik z noteToMarkdownFile wraca z tymi samymi nazwami pól i wartościami tekstowymi", () => {
    const defs: PropDef[] = [{ id: "c", name: "Cena", type: "number", order: 0 }, { id: "t", name: "title", type: "text", order: 1 }];
    const note = { id: "1", title: "Ofert", content: "", color: "default", pinned: false, archived: false, trashed: false, trashedAt: null, labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null, order: 0, createdAt: 0, updatedAt: 0, props: { c: 12.5, t: "tak" } } as Note;
    const parsed = parseMarkdownNote(noteToMarkdownFile(note, defs), { path: "Ofert.md" });
    expect(parsed.props).toEqual({ Cena: "12,5", title: "tak" });
    expect(parsed.title).toBe("Ofert");
  });
});
