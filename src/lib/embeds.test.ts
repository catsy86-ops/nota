import { describe, it, expect } from "vitest";
import { extractSection, isBlockEmbed, splitEmbedTarget, MAX_EMBED_DEPTH } from "./embeds";

const doc = [
  "# Plan",
  "wstęp",
  "## Etap 1",
  "- zrobić A",
  "### Szczegóły",
  "- detal",
  "## Etap 2",
  "- zrobić B",
  "# Inny dział",
  "tekst",
].join("\n");

describe("extractSection", () => {
  it("bierze sekcję do następnego nagłówka tego samego lub wyższego poziomu", () => {
    expect(extractSection(doc, "Etap 1")).toBe("## Etap 1\n- zrobić A\n### Szczegóły\n- detal");
  });

  it("sekcja najwyższego poziomu idzie aż do następnego takiego samego", () => {
    expect(extractSection(doc, "Plan")).toBe(doc.split("\n").slice(0, 8).join("\n"));
  });

  it("dopasowanie bez względu na wielkość liter i spacje; brak nagłówka → null", () => {
    expect(extractSection(doc, "  etap 2 ")).toBe("## Etap 2\n- zrobić B");
    expect(extractSection(doc, "nie ma")).toBeNull();
  });
});

describe("cele osadzeń", () => {
  it("dzieli tytuł i nagłówek", () => {
    expect(splitEmbedTarget("Plan#Etap 1")).toEqual({ title: "Plan", heading: "Etap 1" });
    expect(splitEmbedTarget("Plan")).toEqual({ title: "Plan", heading: null });
  });

  it("nagłówek z ^ to osadzenie bloku", () => {
    expect(isBlockEmbed("^abc")).toBe(true);
    expect(isBlockEmbed("Etap")).toBe(false);
    expect(isBlockEmbed(null)).toBe(false);
  });

  it("limit głębokości to 3", () => {
    expect(MAX_EMBED_DEPTH).toBe(3);
  });
});
