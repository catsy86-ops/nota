import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MarkdownRendererImpl as MarkdownRenderer } from "./MarkdownRendererImpl";

function html(md: string) {
  const { container } = render(<MarkdownRenderer content={md} />);
  return container;
}

describe("MarkdownRenderer - XSS (A03)", () => {
  it("link javascript: nie ma href", () => {
    const c = html("[kliknij](javascript:alert(1))");
    const a = c.querySelector("a");
    expect(a?.getAttribute("href") ?? null).toBeNull();
    expect(c.innerHTML.toLowerCase()).not.toContain("javascript:");
  });

  it.each([
    "[x](JaVaScRiPt:alert(1))", "[x](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)",
    "[x](vbscript:msgbox(1))", "[x](java&#x73;cript:alert(1))", "[x](&#106;avascript:alert(1))",
  ])("odrzuca %s", (md) => {
    const a = html(md).querySelector("a");
    expect(a?.getAttribute("href") ?? null).toBeNull();
  });

  it("surowy HTML w treści jest tekstem, nie elementem", () => {
    const c = html('<img src=x onerror="window.__xss=1"><script>window.__xss=1</script><iframe src="javascript:1"></iframe>');
    expect(c.querySelector("script")).toBeNull();
    expect(c.querySelector("iframe")).toBeNull();
    expect(c.querySelector("img")).toBeNull();
    expect((window as unknown as { __xss?: number }).__xss).toBeUndefined();
  });

  it("obraz Markdown nie jest ładowany automatycznie (brak <img>), jest linkiem", () => {
    const c = html("![piksel](https://tracker.example/p.gif)");
    expect(c.querySelector("img")).toBeNull();
    const a = c.querySelector("a");
    expect(a?.getAttribute("href")).toBe("https://tracker.example/p.gif");
    expect(a?.getAttribute("rel")).toContain("noreferrer");
  });

  it("obraz z data: nie daje ani <img>, ani linku", () => {
    const c = html("![x](data:image/svg+xml;base64,PHN2Zy8+)");
    expect(c.querySelector("img")).toBeNull();
    expect(c.querySelector("a")).toBeNull();
  });

  it("zwykły link https dostaje noopener noreferrer i target=_blank", () => {
    const a = html("[ok](https://example.com)").querySelector("a")!;
    expect(a.getAttribute("href")).toBe("https://example.com");
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.getAttribute("rel")).toContain("noopener");
  });
});
