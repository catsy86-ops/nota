import { describe, it, expect } from "vitest";
import { htmlToMarkdown } from "./htmlToMarkdown";

describe("htmlToMarkdown", () => {
  it("nagłówki, pogrubienie i kursywa", () => {
    expect(htmlToMarkdown("<h2>Plan</h2><p>To <strong>ważne</strong> i <em>pilne</em>.</p>")).toBe("## Plan\n\nTo **ważne** i *pilne*.");
  });

  it("listy punktowane i numerowane", () => {
    expect(htmlToMarkdown("<ul><li>mleko</li><li>chleb</li></ul><ol><li>raz</li><li>dwa</li></ol>"))
      .toBe("- mleko\n- chleb\n\n1. raz\n2. dwa");
  });

  it("linki tylko http(s); inne schematy zostają jako tekst", () => {
    expect(htmlToMarkdown('<a href="https://example.com/a">strona</a>')).toBe("[strona](https://example.com/a)");
    expect(htmlToMarkdown('<a href="javascript:alert(1)">klik</a>')).toBe("klik");
  });

  it("kod i bloki kodu", () => {
    expect(htmlToMarkdown("<p>Użyj <code>npm test</code></p>")).toBe("Użyj `npm test`");
    expect(htmlToMarkdown("<pre>a\nb</pre>")).toBe("```\na\nb\n```");
  });

  it("cytat", () => {
    expect(htmlToMarkdown("<blockquote><p>ktoś</p></blockquote>")).toBe("> ktoś");
  });

  it("skrypty, style i obrazy są pomijane, tekst zostaje", () => {
    expect(htmlToMarkdown("<style>p{}</style><script>x()</script><p>tekst<img src='a.png'></p>")).toBe("tekst");
  });

  it("pusty albo bez tekstu → pusty napis", () => {
    expect(htmlToMarkdown("<div></div>")).toBe("");
    expect(htmlToMarkdown("   ")).toBe("");
  });
});
