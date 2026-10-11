import { describe, it, expect } from "vitest";
import { mentionQueryAt, suggestMentions, completeMention } from "./mentions";

const NOW = new Date(2026, 9, 12, 10, 0); // poniedziałek

describe("mentionQueryAt", () => {
  it("wykrywa @ na początku tekstu i po spacji", () => {
    expect(mentionQueryAt("@ju", 3)).toEqual({ start: 0, query: "ju" });
    expect(mentionQueryAt("Spotkanie @", 11)).toEqual({ start: 10, query: "" });
    expect(mentionQueryAt("a\n@wc", 5)).toEqual({ start: 2, query: "wc" });
  });
  it("ignoruje adresy e-mail i zamknięte zapytania", () => {
    expect(mentionQueryAt("jan@firma.pl", 12)).toBeNull();
    expect(mentionQueryAt("@jutro i dalej", 14)).toBeNull();
  });
});

describe("suggestMentions", () => {
  const titles = ["Zakupy", "Plan tygodnia", "Pomysły"];
  it("bez zapytania: daty, potem najświeższe notatki", () => {
    const r = suggestMentions("", titles, "", NOW);
    expect(r.map((i) => i.label)).toEqual(["Dziś", "Jutro", "Wczoraj", "Zakupy", "Plan tygodnia", "Pomysły"]);
    expect(r[1].text).toBe("wtorek, 13 października");
  });
  it("filtruje daty i notatki po zapytaniu, pomija edytowaną notatkę", () => {
    expect(suggestMentions("ju", titles, "", NOW).map((i) => i.label)).toEqual(["Jutro"]);
    expect(suggestMentions("pl", titles, "Plan tygodnia", NOW)).toEqual([]);
    expect(suggestMentions("za", titles, "", NOW)[0]).toMatchObject({ hint: "notatka", text: "[[Zakupy]]" });
  });
});

describe("completeMention", () => {
  it("zastępuje @zapytanie wstawką i ustawia karetkę za nią", () => {
    const text = "Do: @za reszta";
    expect(completeMention(text, { start: 4, query: "za" }, 7, "[[Zakupy]]")).toEqual({ text: "Do: [[Zakupy]] reszta", caret: 14 });
  });
});
