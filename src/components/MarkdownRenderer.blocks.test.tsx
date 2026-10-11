import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { MarkdownRendererImpl as MarkdownRenderer } from "./MarkdownRendererImpl";

function html(md: string) {
  const { container } = render(<MarkdownRenderer content={md} />);
  return container;
}

describe("MarkdownRenderer - tabele i GFM", () => {
  it("renderuje tabelę z nagłówkiem i wyrównaniem kolumn", () => {
    const c = html("| Imię | Wiek |\n| :--- | ---: |\n| Ala | 7 |");
    expect(c.querySelectorAll("table th")).toHaveLength(2);
    expect(c.querySelector("td")?.textContent).toBe("Ala");
    expect((c.querySelectorAll("td")[1] as HTMLElement).style.textAlign).toBe("right");
  });
  it("skreślenie i pole zadania", () => {
    const c = html("~~stare~~\n\n- [x] zrobione\n- [ ] do zrobienia");
    expect(c.querySelector("del")?.textContent).toBe("stare");
    const boxes = c.querySelectorAll('input[type="checkbox"]');
    expect(boxes).toHaveLength(2);
    expect((boxes[0] as HTMLInputElement).checked).toBe(true);
    expect((boxes[1] as HTMLInputElement).checked).toBe(false);
  });
  it("tabela nie omija filtrowania linków", () => {
    const c = html("| a |\n| - |\n| [x](javascript:alert(1)) |");
    expect(c.querySelector("a")?.getAttribute("href") ?? null).toBeNull();
  });
});

describe("MarkdownRenderer - callouty i bloki zwijane", () => {
  it("callout z tytułem i treścią", () => {
    const c = html("> [!warning] Uwaga na termin\n> Oddaj do piątku");
    const note = c.querySelector('[role="note"]');
    expect(note).not.toBeNull();
    expect(note?.textContent).toContain("Uwaga na termin");
    expect(note?.textContent).toContain("Oddaj do piątku");
    expect(note?.textContent).not.toContain("[!warning]");
    expect(c.querySelector("blockquote")).toBeNull();
  });
  it("polskie aliasy typów", () => {
    expect(html("> [!uwaga] x").querySelector('[role="note"]')).not.toBeNull();
    expect(html("> [!wskazówka] x").querySelector('[role="note"]')).not.toBeNull();
  });
  it("blok zwijany jest domyślnie zwinięty, a plus rozwija", () => {
    const closed = html("> [!toggle] Szczegóły\n> ukryta treść").querySelector("details");
    expect(closed).not.toBeNull();
    expect(closed?.hasAttribute("open")).toBe(false);
    expect(closed?.querySelector("summary")?.textContent).toBe("Szczegóły");
    const open = html("> [!info]+ Widoczny\n> treść").querySelector("details");
    expect(open?.hasAttribute("open")).toBe(true);
    const collapsedInfo = html("> [!info]- Zwinięty\n> treść").querySelector("details");
    expect(collapsedInfo?.hasAttribute("open")).toBe(false);
  });
  it("zwykły cytat i nieznany typ zostają cytatem", () => {
    expect(html("> zwykły cytat").querySelector("blockquote")).not.toBeNull();
    const unknown = html("> [!nieznany] x");
    expect(unknown.querySelector("blockquote")).not.toBeNull();
    expect(unknown.querySelector('[role="note"]')).toBeNull();
  });
  it("kliknięcie w blok zwijany nie przechodzi do karty", () => {
    let clicks = 0;
    const { container } = render(
      <div onClick={() => { clicks++; }}><MarkdownRenderer content={"> [!toggle] T\n> x"} /></div>,
    );
    fireEvent.click(container.querySelector("summary")!);
    expect(clicks).toBe(0);
  });
  it("znaczniki HTML w tytule i treści nie są wykonywane", () => {
    const c = html("> [!info] <img src=x onerror=alert(1)>\n> <script>1</script>");
    expect(c.querySelector("img")).toBeNull();
    expect(c.querySelector("script")).toBeNull();
  });
});
