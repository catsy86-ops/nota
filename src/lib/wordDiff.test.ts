import { describe, expect, it } from "vitest";
import { diffWords, paragraphHunks, restoreHunk, tokenize } from "./wordDiff";

const join = (ops: { type: string; text: string }[], keep: "before" | "after") =>
  ops.filter((o) => o.type === "eq" || o.type === (keep === "before" ? "del" : "ins")).map((o) => o.text).join("");

describe("diff słów", () => {
  it("tokeny składają się z powrotem w ten sam tekst", () => {
    const t = "Zamówić  beton,\nna poniedziałek.";
    expect(tokenize(t).join("")).toBe(t);
  });

  it("pokazuje zmienione słowo, a obie strony odtwarzają teksty", () => {
    const ops = diffWords("Kupić mleko i chleb", "Kupić mleko i masło");
    expect(ops.filter((o) => o.type === "del").map((o) => o.text)).toEqual(["chleb"]);
    expect(ops.filter((o) => o.type === "ins").map((o) => o.text)).toEqual(["masło"]);
    expect(join(ops, "before")).toBe("Kupić mleko i chleb");
    expect(join(ops, "after")).toBe("Kupić mleko i masło");
  });

  it("wstawienie w środku i puste teksty", () => {
    expect(diffWords("a c", "a b c").filter((o) => o.type !== "eq").map((o) => `${o.type}:${o.text.trim()}`)).toContain("ins:b");
    expect(diffWords("", "nowe")).toEqual([{ type: "ins", text: "nowe" }]);
    expect(diffWords("stare", "")).toEqual([{ type: "del", text: "stare" }]);
    expect(diffWords("to samo", "to samo")).toEqual([{ type: "eq", text: "to samo" }]);
  });

  it("bardzo długi tekst nie zamraża (diff linii)", () => {
    const long = Array.from({ length: 3000 }, (_, i) => `słowo${i}`).join(" ");
    const ops = diffWords(long, `${long} koniec`);
    expect(join(ops, "after")).toBe(`${long} koniec`);
  });
});

describe("akapity", () => {
  const current = "Wstęp\n\nNowy akapit\n\nKoniec";
  const version = "Wstęp\n\nStary akapit\n\nKoniec";

  it("dzieli na wspólne i zmienione bloki", () => {
    expect(paragraphHunks(current, version)).toEqual([
      { kind: "same", text: "Wstęp" },
      { kind: "changed", current: ["Nowy akapit"], version: ["Stary akapit"] },
      { kind: "same", text: "Koniec" },
    ]);
  });

  it("przywraca tylko wybrany akapit", () => {
    const hunks = paragraphHunks("A\n\nB2\n\nC\n\nD2", "A\n\nB1\n\nC\n\nD1");
    const second = hunks.findIndex((h, i) => h.kind === "changed" && i > 1);
    expect(restoreHunk(hunks, second)).toBe("A\n\nB2\n\nC\n\nD1");
  });

  it("akapit usunięty w bieżącej treści da się przywrócić", () => {
    const hunks = paragraphHunks("A\n\nC", "A\n\nB\n\nC");
    const i = hunks.findIndex((h) => h.kind === "changed");
    expect(restoreHunk(hunks, i)).toBe("A\n\nB\n\nC");
  });
});
