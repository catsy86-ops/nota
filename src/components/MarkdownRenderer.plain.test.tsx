import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MarkdownRenderer, needsMarkdown } from "./MarkdownRenderer";
import { MarkdownRendererImpl } from "./MarkdownRendererImpl";

describe("needsMarkdown", () => {
  it("zwykły tekst — bez parsera", () => {
    expect(needsMarkdown("Kupić mleko i chleb.\nZadzwonić do mamy.")).toBe(false);
    expect(needsMarkdown("Spotkanie o 14:30, sala 2 (piętro 3).")).toBe(false);
  });

  it.each([
    ["**pogrubione**"], ["_kursywa_"], ["`kod`"], ["# Nagłówek"], ["> cytat"], ["[[Inna notatka]]"],
    ["- punkt"], ["1. pierwszy"], ["https://example.com"], ["www.example.com"], ["jan@example.com"],
    ["| a | b |"], ["~~skreślone~~"], ["Tytuł\n---"], ["Tytuł\n==="], ["a &amp; b"], ["<b>html</b>"], ["linia\\"],
  ])("składnia %s — pełny renderer", (text) => {
    expect(needsMarkdown(text)).toBe(true);
  });
});

describe("szybka ścieżka daje to samo co react-markdown", () => {
  it.each([
    ["Jedna linia"],
    ["Pierwsza linia\ndruga linia tego samego akapitu"],
    ["Akapit pierwszy.\n\nAkapit drugi, dłuższy.\n\n\nTrzeci po kilku pustych."],
  ])("%s", (text) => {
    const plain = render(<MarkdownRenderer content={text} />).container;
    const full = render(<MarkdownRendererImpl content={text} />).container;
    const ps = (c: HTMLElement) => Array.from(c.querySelectorAll("p")).map((p) => p.textContent?.replace(/\s+/g, " ").trim());
    expect(ps(plain)).toEqual(ps(full));
  });
});
