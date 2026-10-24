import { describe, it, expect } from "vitest";
import { EXTRACT_TITLE_FALLBACK, EXTRACT_TITLE_MAX, replaceSelectionWithLink, titleFromSelection, uniqueNoteTitle } from "./extractNote";
import { extractWikiLinks, resolveWikiTarget } from "./wikiLinks";
import type { Note } from "@/hooks/useNotes";

describe("titleFromSelection", () => {
  it("bierze pierwszą niepustą linię", () => {
    expect(titleFromSelection("\n  Plan budowy\nreszta treści")).toBe("Plan budowy");
  });

  it("zdejmuje znaczniki Markdown z początku i z pogrubień", () => {
    expect(titleFromSelection("## **Ważne** rzeczy")).toBe("Ważne rzeczy");
    expect(titleFromSelection("- [ ] kupić cement")).toBe("kupić cement");
    expect(titleFromSelection("> cytat")).toBe("cytat");
    expect(titleFromSelection("3. trzeci krok")).toBe("trzeci krok");
  });

  it("usuwa znaki składni linku, które zepsułyby [[cel]]", () => {
    const title = titleFromSelection("Sprawdź [[X]] | Y # Z");
    expect(title).not.toMatch(/[[\]|#]/);
    expect(title).toBe("Sprawdź X Y Z");
  });

  it("przycina długi tytuł do granicy słowa", () => {
    const long = "słowo ".repeat(30).trim();
    const title = titleFromSelection(long);
    expect(title.length).toBeLessThanOrEqual(EXTRACT_TITLE_MAX);
    expect(title.endsWith("słowo")).toBe(true);
  });

  it("zwraca zastępczy tytuł, gdy nie ma tekstu do nazwania", () => {
    expect(titleFromSelection("   \n  ")).toBe(EXTRACT_TITLE_FALLBACK);
    expect(titleFromSelection("[[]]")).toBe(EXTRACT_TITLE_FALLBACK);
  });
});

describe("uniqueNoteTitle", () => {
  it("zostawia tytuł, gdy wolny (bez względu na wielkość liter)", () => {
    expect(uniqueNoteTitle("Plan", ["Inny", "plan budowy"])).toBe("Plan");
    expect(uniqueNoteTitle("plan", ["Plan"])).toBe("plan (2)");
  });

  it("dokłada numer, gdy tytuł zajęty", () => {
    expect(uniqueNoteTitle("Plan", ["Plan", "Plan (2)"])).toBe("Plan (3)");
  });
});

describe("replaceSelectionWithLink", () => {
  it("podmienia zaznaczenie na link i ustawia kursor za nim", () => {
    const r = replaceSelectionWithLink("Przed ŚRODEK po", 6, 12, "Nowa");
    expect(r.content).toBe("Przed [[Nowa]] po");
    expect(r.caret).toBe(6 + "[[Nowa]]".length);
  });

  it("nowy link jest rozpoznawany jako wikilink", () => {
    const { content } = replaceSelectionWithLink("abc def", 4, 7, "Def");
    expect(extractWikiLinks(content)).toEqual(["def"]);
  });

  it("wyodrębniona notatka jest znajdowana przez link", () => {
    const { content } = replaceSelectionWithLink("abc def", 4, 7, "Def");
    const note = { id: "n1", title: "Def", content: "def", aliases: [] } as unknown as Note;
    expect(resolveWikiTarget(extractWikiLinks(content)[0], [note])?.id).toBe("n1");
  });
});
