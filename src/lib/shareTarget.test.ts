import { describe, it, expect, beforeEach } from "vitest";
import { parseShare, claimShare, MAX_TITLE, MAX_TEXT } from "./shareTarget";

const q = (o: Record<string, string>) => "?" + new URLSearchParams(o).toString();

describe("parseShare", () => {
  it("ignores ordinary navigation", () => {
    expect(parseShare("/", "")).toBeNull();
    expect(parseShare("/dzis", q({ title: "x" }))).toBeNull();
  });

  it("builds a note from /share params", () => {
    expect(parseShare("/share", q({ title: "Artykuł", text: "Warto przeczytać", url: "https://example.com/a" }))).toEqual({
      title: "Artykuł",
      content: "Warto przeczytać\n\nhttps://example.com/a",
    });
  });

  it("accepts the legacy share-* params on any path", () => {
    expect(parseShare("/", q({ "share-title": "T", "share-text": "x" }))).toEqual({ title: "T", content: "x" });
  });

  it("does not duplicate a url already present in the text", () => {
    const r = parseShare("/share", q({ text: "zobacz https://example.com/a", url: "https://example.com/a" }));
    expect(r?.content).toBe("zobacz https://example.com/a");
  });

  it("returns null for an empty share", () => {
    expect(parseShare("/share", "")).toBeNull();
    expect(parseShare("/share", q({ title: "  ", text: "" }))).toBeNull();
  });

  it("truncates long values and strips control characters", () => {
    const r = parseShare("/share", q({ title: "a".repeat(MAX_TITLE + 50), text: "b".repeat(MAX_TEXT + 10) + "\u0000" }));
    expect(r?.title.length).toBe(MAX_TITLE);
    expect(r?.content.length).toBe(MAX_TEXT);
    expect(r?.content).not.toContain("\u0000");
  });

  it("keeps markup as inert text and drops non-http urls as links", () => {
    const r = parseShare("/share", q({ title: "<img src=x onerror=alert(1)>", url: "javascript:alert(1)" }));
    expect(r?.title).toBe("<img src=x onerror=alert(1)>");
    expect(r?.content).toBe("javascript:alert(1)");
  });
});

describe("claimShare", () => {
  beforeEach(() => sessionStorage.clear());
  const s = { title: "A", content: "B" };

  it("accepts the first share and rejects a refresh within the window", () => {
    expect(claimShare(s, 1000)).toBe(true);
    expect(claimShare(s, 5000)).toBe(false);
  });

  it("accepts a different share, or the same one after the window", () => {
    expect(claimShare(s, 1000)).toBe(true);
    expect(claimShare({ title: "A", content: "C" }, 2000)).toBe(true);
    expect(claimShare({ title: "A", content: "C" }, 200_000)).toBe(true);
  });
});
