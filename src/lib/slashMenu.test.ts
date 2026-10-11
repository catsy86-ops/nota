import { describe, expect, it } from "vitest";
import { applySlashCommand, filterSlashCommands, slashCommands, slashQueryAt } from "./slashMenu";

const NOW = new Date(2026, 9, 11, 12, 0, 0);
const cmds = slashCommands(NOW);
const byId = (id: string) => cmds.find((c) => c.id === id)!;

/** `|` to karetka. */
function run(src: string, id: string) {
  const caret = src.indexOf("|");
  const text = src.replace("|", "");
  const q = slashQueryAt(text, caret);
  if (!q) return null;
  const r = applySlashCommand(text, q, caret, byId(id));
  return r.value.slice(0, r.selStart) + "|" + r.value.slice(r.selStart);
}

describe("slashQueryAt", () => {
  it("rozpoznaje ukośnik na początku tekstu i linii", () => {
    expect(slashQueryAt("/", 1)).toEqual({ start: 0, query: "" });
    expect(slashQueryAt("ala\n/nag", 8)).toEqual({ start: 4, query: "nag" });
  });
  it("rozpoznaje ukośnik po spacji", () => {
    expect(slashQueryAt("ala /da", 7)).toEqual({ start: 4, query: "da" });
  });
  it("ignoruje ukośnik w środku słowa i w adresach", () => {
    expect(slashQueryAt("a/b", 3)).toBeNull();
    expect(slashQueryAt("https://x.pl", 8)).toBeNull();
  });
  it("zamyka się po spacji, nowej linii i zbyt długim zapytaniu", () => {
    expect(slashQueryAt("/kod x", 6)).toBeNull();
    expect(slashQueryAt("/kod\nx", 6)).toBeNull();
    expect(slashQueryAt(`/${"a".repeat(30)}`, 31)).toBeNull();
  });
  it("nie reaguje, gdy karetka jest przed ukośnikiem", () => {
    expect(slashQueryAt("/kod", 0)).toBeNull();
  });
});

describe("filterSlashCommands", () => {
  it("pusty tekst zwraca wszystkie komendy", () => {
    expect(filterSlashCommands("", cmds)).toHaveLength(cmds.length);
  });
  it("szuka bez ogonków i po słowach kluczowych", () => {
    expect(filterSlashCommands("naglowek", cmds).map((c) => c.id)).toEqual(["h1", "h2", "h3"]);
    expect(filterSlashCommands("zad", cmds)[0].id).toBe("todo");
    expect(filterSlashCommands("dzis", cmds)[0].id).toBe("date");
  });
  it("zwraca pustą listę, gdy nic nie pasuje", () => {
    expect(filterSlashCommands("zzzz", cmds)).toEqual([]);
  });
});

describe("applySlashCommand", () => {
  it("zamienia linię w nagłówek", () => {
    expect(run("/na|", "h2")).toBe("## |");
    expect(run("ala\n/na|", "h1")).toBe("ala\n# |");
  });
  it("zachowuje tekst po karetce", () => {
    expect(run("/zad| reszta", "todo")).toBe("- [ ] | reszta");
  });
  it("wstawia blok kodu z karetką w środku", () => {
    expect(run("/kod|", "code")).toBe("```\n|\n```");
  });
  it("blok kodu po tekście zaczyna się od nowej linii", () => {
    expect(run("ala /kod|", "code")).toBe("ala \n```\n|\n```");
  });
  it("wstawia dzisiejszą datę w miejscu zapytania", () => {
    expect(run("dzis: /da|", "date")).toBe("dzis: 2026-10-11|");
  });
  it("separator oddziela się pustą linią", () => {
    expect(run("ala\n/sep|", "divider")).toBe("ala\n\n---\n|");
  });
});
