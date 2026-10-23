import { describe, expect, it } from "vitest";
import { makeBigVault } from "./bigVault";
import { extractWikiLinks } from "@/lib/wikiLinks";

describe("makeBigVault", () => {
  it("jest deterministyczny dla tego samego seeda", () => {
    expect(makeBigVault(50, 7)).toEqual(makeBigVault(50, 7));
    expect(makeBigVault(50, 7)).not.toEqual(makeBigVault(50, 8));
  });

  it("daje żądaną liczbę notatek z unikalnymi id i linkami do poprzednich", () => {
    const notes = makeBigVault(1000);
    expect(notes).toHaveLength(1000);
    expect(new Set(notes.map((n) => n.id)).size).toBe(1000);
    expect(extractWikiLinks(notes[5].content)).toEqual([notes[4].title]);
    expect(notes.filter((n) => n.labels.length > 0).length).toBeGreaterThan(0);
  });
});
