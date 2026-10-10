import { describe, it, expect } from "vitest";
import { parsePastedUrl } from "./urlTitle";

describe("parsePastedUrl", () => {
  it("wyciąga domenę bez www", () => {
    expect(parsePastedUrl("https://www.example.com/a/b?x=1")).toEqual({ url: "https://www.example.com/a/b?x=1", title: "example.com" });
    expect(parsePastedUrl("  http://docs.example.org  ")?.title).toBe("docs.example.org");
  });
  it("odrzuca tekst, który nie jest samym adresem", () => {
    expect(parsePastedUrl("zobacz https://example.com")).toBeNull();
    expect(parsePastedUrl("example.com")).toBeNull();
    expect(parsePastedUrl("javascript:alert(1)")).toBeNull();
    expect(parsePastedUrl("mailto:a@b.pl")).toBeNull();
    expect(parsePastedUrl("")).toBeNull();
  });
});
